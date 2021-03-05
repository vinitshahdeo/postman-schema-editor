// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode'),
	fs = require('fs'),
	path = require('path'),
	utils = require('./utils'),
	_ = require('lodash'),
	apiTree = require('./apiTree');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed


function clearStore(context) {
	workspaces = JSON.parse(context.workspaceState.get("postmanSchemaFetch.ws", "[]"));
	_.forEach(workspaces, ws => {
		apis = JSON.parse(context.workspaceState.get(ws.id, "[]"));
		_.forEach(apis, api => {
			context.workspaceState.update(api.id, undefined);
		});
		context.workspaceState.update(ws.id, undefined);
	});

	context.workspaceState.update("postmanSchemaFetch.ws", undefined);
}

function insertToListInStore(context, key, value, type) {
	value['type'] = type;
	storedItems = JSON.parse(context.workspaceState.get(key, "[]"));
	storedItems.push(value);
	
	storedItems = _.uniqWith(storedItems, _.isEqual, "id")
	context.workspaceState.update(key, JSON.stringify(storedItems));
}

function setListInStore(context, key, value, type) {
	_.forEach(value, (item) => {
		item['type'] = type;
	});

	context.workspaceState.update(key, JSON.stringify(value));
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	// clearStore(context);

	vscode.window.registerTreeDataProvider('postmanApis', apiTree.PostmanApiProvider(context));
	var data = {
		xApiKey: '',
		workspace: {},
		api: {},
		apiVersion: {},
		schema: {}
	};

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "postman-schema-editor" is now active!');

	let apiKey = vscode.workspace.getConfiguration().get('postmanSchemaEditor.apiKey');
	if (_.isEmpty(apiKey)) {
		let choice = await vscode.window.showInformationMessage('You can add an API key here', ...['yes', 'no']);
		if (choice === 'yes') {
			vscode.commands.executeCommand('workbench.action.openSettings', 'postmanSchemaEditor.apiKey');
		}
	}
	else {
		data.xApiKey = apiKey;
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let fetchCommandDisposer = vscode.commands.registerCommand('postman-schema-editor.fetchPostmanSchema', async function () {
		// The code you place here will be executed every time your command is executed

		let apiKey = vscode.workspace.getConfiguration().get('postmanSchemaEditor.apiKey');
		if (!apiKey) {
			let apiKey = await utils.showInputBox({
				placeHolder: 'Enter your API key',
				password: true,
				prompt: 'This will be used to authenticate requests to Postman API'
			});

			data.xApiKey = apiKey;
			vscode.workspace.getConfiguration().update('postmanSchemaEditor.apiKey', apiKey);
		}
		else {
			data.xApiKey = apiKey;
		}

		let disposer = utils.setStatusBarMessage('Fetching your workspaces');
		utils.getWorkspaces(data.xApiKey, function (error, workspaces) {
			disposer.dispose();
			if (error) {
				utils.showError('Some error occurred while fetching workspaces ' + error);
				return;
			}

			if (_.isEmpty(workspaces)) {
				utils.showError('No workspaces found for the user');
				return;
			}

			utils.showDropdown(workspaces, 'Select the worskpace').then((workspace) => {
				data.workspace = workspace;

				disposer = utils.setStatusBarMessage('Fetching APIs in the selected workspace');
				utils.getApisInAWorkspace(data.xApiKey, data.workspace, function (error, apis) {

					insertToListInStore(context, "postmanSchemaFetch.ws", data.workspace, 'workspace');

					disposer.dispose();
					if (error) {
						utils.showError('Some error occurred while fetching APIs in the workspace ' + error);
						return;
					}

					if (_.isEmpty(apis)) {
						utils.showError('No apis found for the user');
						return;
					}

					utils.showDropdown(apis, 'Select an API').then((api) => {
						data.api = api;

						insertToListInStore(context, data.workspace.id, api, 'api');

						disposer = utils.setStatusBarMessage('Fetching versions of the selected API');
						utils.getApiVersions(data.xApiKey, data.api, function (error, apiVersions) {

							setListInStore(context, data.api.id, apiVersions, 'apiVersion');

							disposer.dispose();
							if (error) {
								utils.showError('Some error occurred while fetching versions of an API ' + error);
								return;
							}

							if (_.isEmpty(apiVersions)) {
								utils.showError('No api versions found for the provided API');
								return;
							}
							// context.workspaceState.

							utils.showDropdown(apiVersions, 'Select an API version').then((apiVersion) => {
								data.apiVersion = apiVersion;

								disposer = utils.setStatusBarMessage('Fetching schema of the API version provided');
								utils.fetchAPISchema({
									apiKey: data.xApiKey,
									apiId: data.api.id,
									apiVersionId: data.apiVersion.id
								}, (err, schema) => {
									data.schema = schema;
									disposer.dispose();

									if (err) {
										utils.showError('Something went wrong while fetching API schema, please try again');
										return;
									}
									else {
										utils.showError(vscode.workspace.workspaceFolders[0].uri.toString());

										let folderPath = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];
										let filePath = path.join(folderPath, `${data.api.name}-${data.apiVersion.name}.${data.schema.language}`);

										fs.writeFile(filePath, schema.schema, {}, (err) => {
											if (err) {
												utils.showError('Some error occurred while writing schema to the file ' + err);
											}
											else {
												let openPath = vscode.Uri.file(filePath);
												vscode.workspace.openTextDocument(openPath).then(doc => {
													vscode.window.showTextDocument(doc);
													utils.showInfo('API Schema fetched successfully!')
												});
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

	let publishCommandDisposer = vscode.commands.registerCommand('postman-schema-editor.publishSchemaToPostman', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			let document = editor.document,
				// Get the document text
				updatedSchema = document.getText();
			let disposer = utils.setStatusBarMessage('Uploading the schema to postman');
			utils.updateAPISchema({
				apiKey: data.xApiKey,
				apiId: data.api.id,
				apiVersionId: data.apiVersion.id,
				schemaId: data.schema.id,
				schemaType: data.schema.type,
				schemaLanguage: data.schema.language,
				schema: updatedSchema
			}, (error, response) => {
				disposer.dispose();

				if (error || response.statusCode !== 200) {
					utils.showError('Some error occurred while publishing the schema ' + error);
					return;
				}
				else {
					utils.showInfo('Successfully published the updated schema to postman :tada: !');
				}
			});
		}
		else {
			utils.showError('Please have your schema in active tab and execute the command !');
		}
	});

	context.subscriptions.push(fetchCommandDisposer, publishCommandDisposer);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
