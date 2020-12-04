// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode'),
	fs = require('fs'),
	path = require('path'),
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

			let disposer = utils.setStatusBarMessage('Fetching your workspaces');
			utils.getWorkspaces(data.xApiKey, function (error, workspaces) {
				disposer.dispose();
				if (error) {
					utils.showError('Some error occurred while fetching workspaces ' + error);
					return;
				}

				if (!workspaces) {
					utils.showError('No workspaces found for the user');
					return;
				}

				utils.showDropdown(workspaces,'Select the worskpace').then((workspace) => {
					data.workspace = workspace;

					disposer = utils.setStatusBarMessage('Fetching APIs in the selected workspace');
					utils.getApisInAWorkspace(data.xApiKey, data.workspace, function (error, apis) {
						disposer.dispose();
						if (error) {
							utils.showError('Some error occurred while fetching APIs in the workspace ' + error);
							return;
						}

						if (!apis) {
							utils.showError('No apis found for the user');
							return;
						}

						utils.showDropdown(apis,'Select an API').then((api) => {
							data.api = api;

							disposer = utils.setStatusBarMessage('Fetching versions of the selected API');
							utils.getApiVersions(data.xApiKey, data.api, function (error, apiVersions) {
								disposer.dispose();
								if (error) {
									utils.showError('Some error occurred while fetching versions of an API ' + error);
									return;
								}

								if (!apiVersions) {
									utils.showError('No api versions found for the provided API');
									return;
								}

								utils.showDropdown(apiVersions, 'Select an API version').then((apiVersion) => {
									data.apiVersion = apiVersion;

									utils.fetchAPISchema({
										apiKey: data.xApiKey,
										apiId: data.api.id,
										apiVersionId: data.apiVersion.id
									}, (err, res) => {
										if (err) {
											utils.showError('Something went wrong while fetching API schema, please try again');
											return;
										}
										else {
											let folderPath = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];
											// todo: change the name of file
											fs.writeFile(path.join(folderPath, 'schema.json'), res, {}, (err) => {
												if (err) {
													utils.showError('Some error occurred while writing the file ' + err);
												}
												else {
													utils.showInfo('API Schema is fetched successfully!');
												}
											});
										}
									});
								});
							});
						});
					});
				});
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
