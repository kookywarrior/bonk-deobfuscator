const cloneDeep = require("lodash.clonedeep")
const walk = require("acorn-walk")
const esprima = require("esprima")
const estraverse = require("estraverse")
const escodegen = require("escodegen")
const fs = require("fs")

async function start() {
	const LINK = "https://bonk.io/js/alpha2s.js"
	let code = await fetch(LINK).then((res) => res.text())
	const splitedText = code.split("requirejs")
	let ast = esprima.parseScript(code)

	function getMainFunctionName(ast) {
		for (let node of ast.body) {
			if (node.type === "FunctionDeclaration" && node.id && node.id.type === "Identifier") {
				return node.id.name
			}
		}
		return null
	}

	function getMainArray(ast, elementCount) {
		for (let node of ast.body) {
			if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
				const right = node.expression.right
				if (right && right.type === "ArrayExpression" && right.elements.length > elementCount) {
					if (node.expression.left.type === "Identifier") {
						for (const element of right.elements) {
							if (!stringGetterFunctionNames.includes(element.callee.property.name)) {
								stringGetterFunctionNames.push(element.callee.property.name)
							}
						}
						return node.expression.left.name
					}
				}
			}
		}
		return null
	}

	const MAINFUNCTION = getMainFunctionName(ast)
	if (MAINFUNCTION == null) {
		console.error("MAINFUNCTION not found")
		return
	}

	const stringGetterFunctionNames = []
	const MAINARRAY = getMainArray(ast, 1000)
	if (MAINARRAY == null) {
		console.error("MAINARRAY not found")
		return
	}

	const sandboxCode = `function sandbox(){${splitedText[0]};return [${MAINFUNCTION}, ${MAINARRAY}]};sandbox()`
	const [MAINFUNCTIONEVAL, MAINARRAYEVAL] = eval(sandboxCode)

	let scopeStack = []
	let globalScope = {}

	function resolveVariable(name) {
		for (let i = scopeStack.length - 1; i >= 0; i--) {
			const scope = scopeStack[i]
			if (scope[name]) {
				return scope[name]
			}
		}
		return globalScope[name] || null
	}

	// FROM: var a = MAINFUNCTION; a.abc(123);
	// TO: MAINFUNCTION.abc(123);
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.push({})
			}

			if (node.type === "VariableDeclarator") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.init && node.init.type === "Identifier") {
					currentScope[node.id.name] = node.init.name
				}
			}

			if (node.type === "AssignmentExpression") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.right.type === "Identifier") {
					if (node.left.type === "Identifier") {
						currentScope[node.left.name] = node.right.name
					}
				}
			}

			if (node.type === "MemberExpression") {
				if (node.object.type === "Identifier") {
					const resolvedName = resolveVariable(node.object.name)
					if (resolvedName === MAINFUNCTION) {
						node.object.name = MAINFUNCTION
					}
				}
			}
		},

		leave(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.pop()
			}
		}
	})

	// Get Math Operation Property Name
	let mathGetterPropertyName, mathSetterPropertyName, mathSwitch
	estraverse.traverse(ast, {
		enter(node) {
			if (node.type === "ObjectExpression" && node.properties.length === 2) {
				const firstNode = node.properties[0]
				const secondNode = node.properties[1]

				if (firstNode.key.type === "Identifier" && firstNode.value.type === "FunctionExpression" && firstNode.value.body.type === "BlockStatement") {
					const body = firstNode.value.body.body

					for (const element of body) {
						if (element.type === "SwitchStatement" && element.cases.length > 200) {
							mathGetterPropertyName = firstNode.key.name
							mathSetterPropertyName = secondNode.key.name
							mathSwitch = element

							this.break()
						}
					}
				}
			}
		}
	})

	if (mathGetterPropertyName == null || mathSetterPropertyName == null || mathSwitch == null) {
		console.error("Math Operation not found")
		return
	}

	// Get Math Operation Function Name
	const mathGetterFunctionNames = []
	const mathSetterFunctionNames = []
	estraverse.traverse(ast, {
		enter(node) {
			if (node.type === "AssignmentExpression") {
				if (
					node.left.type === "MemberExpression" &&
					node.left.object.type === "Identifier" &&
					node.left.object.name === MAINFUNCTION &&
					node.left.property.type === "Identifier" &&
					node.right.type === "FunctionExpression" &&
					node.right.body.type === "BlockStatement" &&
					node.right.body.body.length === 1 &&
					node.right.body.body[0].type === "ReturnStatement" &&
					node.right.body.body[0].argument.type === "ConditionalExpression" &&
					node.right.body.body[0].argument.alternate.type === "MemberExpression" &&
					node.right.body.body[0].argument.alternate.property &&
					node.right.body.body[0].argument.alternate.property.type === "Identifier"
				) {
					if (node.right.body.body[0].argument.alternate.property.name === mathGetterPropertyName) {
						mathGetterFunctionNames.push(node.left.property.name)
					}
					if (node.right.body.body[0].argument.alternate.property.name === mathSetterPropertyName) {
						mathSetterFunctionNames.push(node.left.property.name)
					}
				}
			}
		}
	})

	// FROM: mathSetterFunctionNames(0); var a = mathGetterFunctionNames(1, 2); var b = mathGetterFunctionNames(variable1, 1)
	// TO: var a = 1; var b = 1 - variable1
	let tmpMathSetterArg
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "CallExpression") {
				if (
					node.callee.type === "MemberExpression" &&
					node.callee.object.type === "Identifier" &&
					node.callee.object.name === MAINFUNCTION &&
					node.callee.property.type === "Identifier"
				) {
					if (mathSetterFunctionNames.includes(node.callee.property.name)) {
						tmpMathSetterArg = node.arguments[0].value
					} else if (mathGetterFunctionNames.includes(node.callee.property.name)) {
						let argsAllLiteral = true
						const args = []
						const argsValue = []

						for (const arg of node.arguments) {
							args.push(arg)
							if (arg.type !== "Literal") {
								argsAllLiteral = false
							} else {
								argsValue.push(arg.value)
							}
						}

						if (argsAllLiteral) {
							MAINFUNCTIONEVAL[mathSetterFunctionNames[0]](tmpMathSetterArg)
							const result = MAINFUNCTIONEVAL[mathGetterFunctionNames[0]](...argsValue)
							if (result >= 0) {
								return {
									type: "Literal",
									value: result,
									raw: String(result)
								}
							} else {
								return {
									type: "UnaryExpression",
									operator: "-",
									prefix: true,
									argument: {
										type: "Literal",
										value: Math.abs(result),
										raw: String(Math.abs(result))
									}
								}
							}
						} else {
							for (const switchCase of mathSwitch.cases) {
								if (switchCase.test.value === tmpMathSetterArg) {
									let BinaryExpression = cloneDeep(switchCase.consequent[0].expression.right)
									walk.simple(BinaryExpression, {
										MemberExpression(tmpNode) {
											Object.assign(tmpNode, args[tmpNode.property.value])
										}
									})
									return BinaryExpression
								}
							}
						}
					}
				}
			}
		}
	})

	scopeStack = []
	globalScope = {}

	// FROM: var a = MAINARRAY; a[123]; var b = []; b[12] = MAINARRAY; b[12][123]
	// TO: var a = MAINARRAY; MAINARRAY[123]; var b = []; MAINARRAY = MAINARRAY; MAINARRAY[123]
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.push({})
			}

			if (node.type === "VariableDeclarator") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.init && node.init.type === "Identifier") {
					currentScope[node.id.name] = node.init.name
				}
			}

			if (node.type === "AssignmentExpression") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.right.type === "Identifier") {
					if (node.left.type === "Identifier") {
						currentScope[node.left.name] = node.right.name
					} else if (node.left.type === "MemberExpression" && node.left.object.type === "Identifier" && node.left.property.type === "Literal") {
						currentScope[`${node.left.object.name}[${node.left.property.value}]`] = node.right.name
					}
				}
			}

			if (node.type === "Identifier") {
				const resolvedName = resolveVariable(node.name)
				if (resolvedName === MAINARRAY) {
					node.name = MAINARRAY
				}
			}

			if (node.type === "MemberExpression") {
				const resolvedName = resolveVariable(`${node.object.name}[${node.property.value || node.property.name}]`)
				if (resolvedName === MAINARRAY) {
					return {
						type: "Identifier",
						name: MAINARRAY
					}
				}
			}
		},

		leave(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.pop()
			}
		}
	})

	// FROM: var a = stringGetterFunctionName(10)
	// TO: var a = "real string value"
	scopeStack = []
	globalScope = {}
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.push({})
			}

			if (node.type === "VariableDeclarator") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.init && node.init.type === "Literal") {
					currentScope[node.id.name] = node.init.value
				}
			}

			if (node.type === "AssignmentExpression") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.right.type === "Literal") {
					if (node.left.type === "Identifier") {
						currentScope[node.left.name] = node.right.value
					} else if (node.left.type === "MemberExpression" && node.left.object.type === "Identifier" && node.left.property.type === "Literal") {
						currentScope[`${node.left.object.name}[${node.left.property.value}]`] = node.right.value
					}
				}
			}

			if (node.type === "CallExpression") {
				if (
					node.callee.type === "MemberExpression" &&
					node.callee.object.type === "Identifier" &&
					node.callee.object.name === MAINFUNCTION &&
					node.callee.property.type === "Identifier"
				) {
					if (stringGetterFunctionNames.includes(node.callee.property.name)) {
						if (node.arguments[0].type === "Literal") {
							const result = MAINFUNCTIONEVAL[stringGetterFunctionNames[0]](node.arguments[0].value)
							return {
								type: "Literal",
								value: result
							}
						} else if (node.arguments[0].type === "Identifier") {
							const resolved = resolveVariable(node.arguments[0].name)
							if (resolved !== null && resolved.toString() !== "NaN" && typeof resolved === "number") {
								if (resolved >= 0) {
									const result = MAINFUNCTIONEVAL[stringGetterFunctionNames[0]](resolved)
									return {
										type: "Literal",
										value: result
									}
								}
							}
						} else if (
							node.arguments[0].type === "MemberExpression" &&
							node.arguments[0].object.type === "Identifier" &&
							node.arguments[0].property.type === "Literal"
						) {
							const resolved = resolveVariable(`${node.arguments[0].object.name}[${node.arguments[0].property.value}]`)
							if (resolved !== null && resolved.toString() !== "NaN" && typeof resolved === "number") {
								if (resolved >= 0) {
									const result = MAINFUNCTIONEVAL[stringGetterFunctionNames[0]](resolved)
									return {
										type: "Literal",
										value: result
									}
								}
							}
						}
					}
				}
			}
		},

		leave(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.pop()
			}
		}
	})

	// FROM: var a = MAINARRAY[10]
	// TO: var a = "real string value"
	scopeStack = []
	globalScope = {}
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.push({})
			}

			if (node.type === "VariableDeclarator") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.init && node.init.type === "Literal") {
					currentScope[node.id.name] = node.init.value
				}
			}

			if (node.type === "AssignmentExpression") {
				const currentScope = scopeStack[scopeStack.length - 1] || globalScope
				if (node.right.type === "Literal") {
					if (node.left.type === "Identifier") {
						currentScope[node.left.name] = node.right.value
					} else if (node.left.type === "MemberExpression" && node.left.object.type === "Identifier" && node.left.property.type === "Literal") {
						currentScope[`${node.left.object.name}[${node.left.property.value}]`] = node.right.value
					}
				}
			}

			if (node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === MAINARRAY) {
				if (node.property.type === "Literal") {
					const result = MAINARRAYEVAL[node.property.value]
					if (result == null) {
						// null main array
					} else {
						return {
							type: "Literal",
							value: result
						}
					}
				} else if (node.property.type === "Identifier") {
					const resolved = resolveVariable(node.property.name)
					if (resolved !== null && resolved.toString() !== "NaN" && typeof resolved === "number") {
						if (resolved >= 0) {
							const result = MAINARRAYEVAL[resolved]
							if (result == null) {
								// null main array
							} else {
								return {
									type: "Literal",
									value: result
								}
							}
						}
					}
				} else if (node.property.type === "MemberExpression" && node.property.object.type === "Identifier" && node.property.property.type === "Literal") {
					const resolved = resolveVariable(`${node.property.object.name}[${node.property.property.value}]`)
					if (resolved !== null && resolved.toString() !== "NaN" && typeof resolved === "number") {
						if (resolved >= 0) {
							const result = MAINARRAYEVAL[resolved]
							if (result == null) {
								// null main array
							} else {
								return {
									type: "Literal",
									value: result
								}
							}
						}
					}
				}
			}
		},

		leave(node) {
			if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
				scopeStack.pop()
			}
		}
	})

	// Remove MAINARRAY = MAINARRAY
	// Remove Literal = Literal
	estraverse.replace(ast, {
		enter(node) {
			if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
				const left = node.expression.left
				const right = node.expression.right
				if (left.type === "Identifier" && right.type === "Identifier" && left.name === right.name) {
					this.remove()
				} else if (left.type === "Literal" && right.type === "Literal" && left.value === right.value) {
					this.remove()
				}
			}
		}
	})

	// Generate updated code
	const updatedCode = escodegen.generate(ast)
	const updatedCodeSplit = updatedCode.split("requirejs")
	try {
		fs.writeFileSync("output.js", splitedText[0] + "requirejs" + updatedCodeSplit[1])
	} catch (error) {
		console.error(error)
	}
}

start()
