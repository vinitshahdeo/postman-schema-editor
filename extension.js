// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode'),
	utils = require('./utils');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	var data = {
		xApiKey: '',
		workspace: '',
		api: '',
		apiVersion: ''
	};

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "postman-schema-editor" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('postman-schema-editor.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		utils.showInputBox('Enter your API Key').then((apiKey) => {
			data.xApiKey = apiKey;
			
			utils.getWorkspaces(data.xApiKey, function (error, workspaces) {
				if (error) {
					utils.showError('Some error occurred while fetching workspaces ' + error);
					return;
				}

				if (!workspaces) {
					utils.showError('No workspaces found for the user');
				}

				utils.showDropdown(workspaces,'Select the worskpace').then((workspace) => {
					data.workspace = workspace;

					utils.getApisInAWorkspace(data.xApiKey, data.workspace, function (error, apis) {
						if (error) {
							utils.showError('Some error occurred while fetching APIs in the workspace ' + error);
							return;
						}

						if (!apis) {
							utils.showError('No apis found for the user');
						}

						utils.showDropdown(apis,'Select an API').then((api) => {
							data.api = api;

							utils.getApiVersions(data.xApiKey, data.api, function (error, apiVersions) {
								if (error) {
									utils.showError('Some error occurred while fetching versions of an API ' + error);
									return;
								}

								if (!apiVersions) {
									utils.showError('No api versions found for the provided API');
								}

								utils.showDropdown(apiVersions, 'Select an API version').then((apiVersion) => {
									data.apiVersion = apiVersion;
									
									// TODO 
									// add a function in utils to fetch the schema from api version and use it here
								});
							});
						});
					});
				});
			});
		});
	});

	context.subscriptions.push(disposable);

	let publishCommand = vscode.commands.registerCommand('postman-schema-editor.publishToPostman', function () {
		// The code you place here will be executed every time your command is executed
		let options = {
			method: 'PUT',
			url: `https://api.getpostman.com/apis/${data.apiId}/versions/${data.apiVersionId}/schemas/${data.schemaId}`,
		
			'headers': {
				'x-api-key': data.xApiKey,
				'Content-Type': 'application/json'
			}
		},
		folderPath = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];

		// Get the active text editor
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            let document = editor.document;
            // Get the document text
			const documentText = document.getText();
			options.body = JSON.stringify({
				"schema": {
					"type": "openapi3",
					"language": "yaml",
					"schema": documentText
				}
			});

			request(options, function (error, response) {
				if (error) {
					vscode.window.showInformationMessage('Some error occurred while downloading the contents ' + error);
					return;
				}
				
				let beautifiedJson = JSON.stringify(JSON.parse(response.body), null, 2);
				
				fs.writeFile(path.join(folderPath, 'openapi2.json'), beautifiedJson, {}, (err) => {
					if (err) {
						vscode.window.showErrorMessage('Some error occurred while writing the file ' + err);
					}
					else {
						vscode.window.showInformationMessage('Executed successfully');
					}
				});
			});
        }
	});

	context.subscriptions.push(publishCommand);


}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
