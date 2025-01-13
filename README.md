# Bonk Deobfuscator

## Overview
This tool is a **partial deobfuscator** for the `alpha2.js` script. It analyzes the obfuscated code, processes it to remove or simplify certain layers of obfuscation, and saves the output as `output.js`.

## Features
- **Partial Deobfuscation**: Simplifies portions of the `alpha2.js` script.
- **Output**: Generates `output.js` with partially deobfuscated content.

## Limitations
- This tool only **partially deobfuscates** the `alpha2.js` script.
- It cannot fully reconstruct the original source code.
- Additional manual analysis may be required for complete understanding or further deobfuscation.

## Requirements
- **Node.js**: Ensure you have Node.js installed on your system.
- **JavaScript Environment**: Compatible with modern JavaScript environments.

## Usage
1. Clone the repository:
   ```bash
   git clone https://github.com/kookywarrior/bonk-deobfuscator.git
   cd bonk-deobfuscator
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the deobfuscator:
   ```bash
   npm run start
   ```
   The tool will automatically retrieve `alpha2.js` from the web, deobfuscate it, and generate a file named `output.js` in the same directory.

## Example
### Obfuscated Code
```javascript
$(document)[t$e[5][673]](function () {
	var R5S = [arguments]
	R5S[9] = M$QCc
	t$e[61][R5S[9][1132]] = new t$e[51](document[R5S[9][223]], 1)
	P()
	t$e[61][R5S[9][1714]]()
	R5S[4] = new g7()
	R5S[5] = localStorage[R5S[9][1089]](k7V.U3q(2465))
	R5S[4][R5S[9][1087]]()
	R5S[6] = new t$e[95]()
	t$e[95][R5S[9][733]]()
})
$[t$e[5][668]](k7V.U3q(528))
	[t$e[5][667]]((g0V, z5Q) => {
		var Z36
		Z36 = M$QCc
		k7V.t8H()
		if (g0V[Z36[62]] == k7V.w65(1563)) {
			for (var p5a = 0; p5a < g0V[Z36[1723]][Z36[47]]; p5a++) {
				t$e[95][Z36[1006]][Z36[101]](
					k7V.w65(4471) +
						g0V[Z36[1723]][p5a][Z36[1031]] +
						k7V.U3q(735) +
						g0V[Z36[1723]][p5a][Z36[1430]] +
						k7V.w65(735) +
						g0V[Z36[1723]][p5a][Z36[113]] +
						k7V.w65(735) +
						g0V[Z36[1723]][p5a][Z36[1429]]
				)
			}
		}
	})
	[t$e[5][666]](function (u_G, W5t, T$_) {
		var c5j = [arguments]
		throw new Error(c5j[0][2])
	})
```

### Deobfuscated Output
```javascript
$(document)["ready"](function () {
	var R5S = [arguments]
	t$e[61]["simpleFPS"] = new t$e[51](document["body"], 1)
	P()
	t$e[61]["resizeGame"]()
	R5S[4] = new g7()
	R5S[5] = localStorage["getItem"]("tutcomplete")
	R5S[4]["showGuestOrAccount"]()
	R5S[6] = new t$e[95]()
	t$e[95]["generateRandomOrder"]()
})
$["post"]("https://bonk2.io/scripts/matchmaking_maps.php")
	["done"]((g0V, z5Q) => {
		var Z36
		B3jF8.t8H()
		if (g0V["r"] == "success") {
			for (var p5a = 0; p5a < g0V["t1"]["length"]; p5a++) {
				t$e[95]["trainingOneStrings"]["push"](
					"2," + g0V["t1"][p5a]["name"] + "," + g0V["t1"][p5a]["authorname"] + "," + g0V["t1"][p5a]["id"] + "," + g0V["t1"][p5a]["leveldata"]
				)
			}
		}
	})
	["fail"](function (u_G, W5t, T$_) {
		var c5j = [arguments]
		throw new Error(c5j[0][2])
	})
```

The output will be saved as `output.js` in the working directory.

## Disclaimer
This tool is intended for educational purposes only. Use responsibly and ensure you comply with relevant laws and regulations. The authors of this tool are not responsible for misuse or any consequences arising from its use.

## Contribution
Contributions are welcome! Feel free to submit issues or pull requests to improve the tool.