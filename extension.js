// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode'),
	request = require('request'),
	fs = require('fs'),
	path = require('path');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "postman-schema-editor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('postman-schema-editor.helloWorld', function () {
		// The code you place here will be executed every time your command is executed
		let options = {
  		method: 'POST',
  		url: 'https://postman-echo.com/post'
		},
		folderPath = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];

		request(options, function (error, response) {
			if (error) {
				vscode.window.showInformationMessage('Some error occurred while downloading the contents ' + error);
				return;
			}
			
			let beautifiedJson = JSON.stringify(JSON.parse(response.body), null, 2);
			
			fs.writeFile(path.join(folderPath, 'openapi.json'), beautifiedJson, {}, (err) => {
				if (err) {
					vscode.window.showErrorMessage('Some error occurred while writing the file ' + err);
				}
				else {
					vscode.window.showInformationMessage('Executed successfully');
				}
			});
		});
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
