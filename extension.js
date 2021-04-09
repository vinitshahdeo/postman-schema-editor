// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode'),
	fs = require('fs'),
	path = require('path'),
	utils = require('./utils'),
	_ = require('lodash'),
	apiTree = require('./apiTree'),
	fetchApiTree = require('./fetchApiTree');

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
	let wsRoot = vscode.workspace.workspaceFolders[0].uri.toString().split(':')[1];

	// clearStore(context);
	let treeProvider = apiTree.PostmanApiProvider(context);

	vscode.window.registerTreeDataProvider('postmanApis', treeProvider);
	vscode.window.registerTreeDataProvider('fetchApi', fetchApiTree.PostmanFetchApiProvider());

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
		let choice = await vscode.window.showInformationMessage('Please provide your API key first', ...['Continue', 'Cancel']);
		if (choice === 'Continue') {
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

		if (_.isEmpty(apiKey)) {
			let choice = await vscode.window.showInformationMessage('Please provide your API key first', ...['Continue', 'Cancel']);
			if (choice === 'Continue') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'postmanSchemaEditor.apiKey');
				return;
			} else {
				return;
			}
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
					disposer.dispose();
					if (error) {
						utils.showError('Some error occurred while fetching APIs in the workspace ' + error);
						return;
					}

					if (_.isEmpty(apis)) {
						utils.showError('No apis found for the user');
						return;
					}

					insertToListInStore(context, "postmanSchemaFetch.ws", data.workspace, 'workspace');

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

							// TODO all storage to be agnostic of WS root
							let apisFolder = `Postman APIs`;

							// TODO all storage to be agnostic of WS root
							if (!fs.existsSync(path.join(wsRoot, apisFolder))) {
								fs.mkdirSync(path.join(wsRoot, apisFolder));
							}

							// TODO all storage to be agnostic of WS root
							let folderPath = path.join(apisFolder, api.name);

							if (!fs.existsSync(path.join(wsRoot, folderPath))) {
								fs.mkdirSync(path.join(wsRoot, folderPath));
							}

							disposer = utils.setStatusBarMessage('Fetching schemas of the API');
							_.forEach(apiVersions, (apiVersion) => {
								data.apiVersion = apiVersion;

								utils.fetchAPISchema({
									apiKey: data.xApiKey,
									apiId: data.api.id,
									apiVersionId: data.apiVersion.id
								}, (err, schema) => {
									data.schema = schema;

									if (err) {
										utils.showError('Something went wrong while fetching API schema, please try again');
										return;
									}
									else {
										if (apiVersion.id === apiVersions[apiVersions.length - 1].id) {
											disposer.dispose();
										}

										let filePath = path.join(folderPath, `${apiVersion.name}.${schema.language}`);
										context.workspaceState.update(apiVersion.id, JSON.stringify({
											'filePath': filePath,
											'apiName': api.name,
											'apiId': api.id,
											'schemaId': schema.id,
											'versionName': apiVersion.name,
											'schemaType': schema.type,
											'schemaLanguage': schema.language
										}));

										treeProvider.refresh();


										fs.writeFile(path.join(wsRoot, filePath), schema.schema, {}, (err) => {
											if (err) {
												utils.showError('Some error occurred while writing schema to the file ' + err);
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

	vscode.commands.registerCommand('postman-schema-editor.openSchemaVersion', versionId => {
		// TODO all storage to be agnostic of WS root
		let filePath = JSON.parse(context.workspaceState.get(versionId))['filePath'];
		openUri = vscode.Uri.file(path.join(wsRoot, filePath));

		vscode.workspace.openTextDocument(openUri).then(doc => {
			vscode.window.showTextDocument(doc, {
				preserveFocus: true,
				preview: true
			});
		});
	});


	vscode.commands.registerCommand('postmanApis.syncVersionToPostman', (element) => {
		let params = JSON.parse(context.workspaceState.get(element.id));
		vscode.window.showWarningMessage(`Publish changes to API \`${params.apiName}\` (version: ${params.versionName}) to Postman?`, "Yes", "Cancel").then((choice) => {

			if (choice === "Yes") {
				// TODO all storage to be agnostic of WS root
				fs.readFile(path.join(wsRoot, params.filePath), "utf8", (err, content) => {
					if (err) {
						utils.showError(JSON.stringify(err));
					}

					let disposer = utils.setStatusBarMessage('Uploading the schema to postman');


					let payload = {
						apiKey: data.xApiKey,
						apiId: params.apiId,
						apiVersionId: element.id,
						schemaId: params.schemaId,
						schemaType: params.schemaType,
						schemaLanguage: params.schemaLanguage,
						schema: content
					};

					utils.updateAPISchema(payload, (error, response) => {
						disposer.dispose();

						if (error || response.statusCode !== 200) {
							utils.showError('Some error occurred while publishing the schema: ' + error);
							return;
						}
						else {
							utils.showInfo('Successfully published updated schema to Postman!');
						}
					});
				});
			}
		}

		);
	});

	vscode.commands.registerCommand('postmanApis.syncVersionFromPostman', (element) => {
		let params = JSON.parse(context.workspaceState.get(element.id));

		vscode.window.showWarningMessage(`Pull changes to API \`${params.apiName}\` (version: ${params.versionName}) from Postman? Your local changes will be lost.`, "Yes", "Cancel").then((choice) => {
			if (choice === 'Yes') {
				utils.fetchAPISchema({
					apiKey: data.xApiKey,
					apiId: params.apiId,
					apiVersionId: element.id
				}, (err, schema) => {

					if (err) {
						utils.showError('Something went wrong while fetching API schema, please try again');
						return;
					}


					else {
						context.workspaceState.update(element.id, JSON.stringify({
							'filePath': params.filePath,
							'apiName': params.apiName,
							'apiId': params.apiId,
							'schemaId': schema.id,
							'versionName': params.versionName,
							'schemaType': schema.type,
							'schemaLanguage': schema.language
						}));
						// TODO all storage to be agnostic of WS root
						fs.writeFile(path.join(wsRoot, params.filePath), schema.schema, {}, (err) => {
							if (err) {
								utils.showError('Some error occurred while writing schema to the file ' + err);
							}
							utils.showInfo('Successfully fetched schema from Postman!');
						});
					}
				});
			}
		});
	});

	vscode.commands.registerCommand('postmanApis.refreshEntry', () => {
		treeProvider.refresh();
	});

	vscode.commands.registerCommand('postmanApis.syncApiToPostman', (element) => {
		let apiVersions = JSON.parse(context.workspaceState.get(element.id));
		vscode.window.showWarningMessage(`Publish all the versions of the API \`${element.name}\`  to Postman?`, "Yes", "Cancel").then((choice) => {

			if (choice === "Yes") {
				
				let disposer = utils.setStatusBarMessage('Uploading the API to Postman');
				// adding this counter to maintain the count of api versions that has been processed
				let apiVersionsProcessed=0;

				_.forEach(apiVersions,(apiVersion)=>{
					const params = JSON.parse(context.workspaceState.get(apiVersion.id));
					fs.readFile(path.join(wsRoot, params.filePath), "utf8", (err, content) => {
						if (err) {
							utils.showError(JSON.stringify(err));
						}
						let payload = {
							apiKey: data.xApiKey,
							apiId: params.apiId,
							apiVersionId: apiVersion.id,
							schemaId: params.schemaId,
							schemaType: params.schemaType,
							schemaLanguage: params.schemaLanguage,
							schema: content
						};
						utils.updateAPISchema(payload, (error, response) => {
							
							if (error || response.statusCode !== 200) {
								disposer.dispose();
								utils.showError('Some error occurred while publishing the API: ' + error);
								return;
							}
							else {
								apiVersionsProcessed++;

								// checking if all the api versions are processed then show the success message.
								if(apiVersionsProcessed===apiVersions.length) {
									disposer.dispose();
									utils.showInfo('Successfully published API to Postman!');
								}
							}
						});
					});
				})	
			}
		});
	});

	vscode.commands.registerCommand('postmanApis.syncApiFromPostman', (element) => {
		let apiVersions = JSON.parse(context.workspaceState.get(element.id));
		vscode.window.showWarningMessage(`Pull changes to all versions of API \`${element.name}\` from Postman? Your local changes will be lost.`, "Yes", "Cancel").then((choice) => {
			if (choice === 'Yes') {
				let disposer = utils.setStatusBarMessage('Fetching API from Postman');
				// adding this counter to maintain the count of api versions that has been processed
				let apiVersionsProcessed=0;

				_.forEach(apiVersions,(apiVersion)=>{
					const params = JSON.parse(context.workspaceState.get(apiVersion.id));
					utils.fetchAPISchema({
						apiKey: data.xApiKey,
						apiId: params.apiId,
						apiVersionId: apiVersion.id
					}, (err, schema) => {
	
						if (err) {
							disposer.dispose();
							utils.showError('Something went wrong while fetching API schemas, please try again');
							return;
						}
						else {
							context.workspaceState.update(apiVersion.id, JSON.stringify({
								'filePath': params.filePath,
								'apiName': params.apiName,
								'apiId': params.apiId,
								'schemaId': schema.id,
								'versionName': params.versionName,
								'schemaType': schema.type,
								'schemaLanguage': schema.language
							}));
							// TODO all storage to be agnostic of WS root
							fs.writeFile(path.join(wsRoot, params.filePath), schema.schema, {}, (err) => {
								if (err) {
									disposer.dispose();
									utils.showError('Some error occurred while writing schemas to the files ' + err);
									return;
								}
								apiVersionsProcessed++;

								// checking if all the versions are processed then show success message
								if(apiVersionsProcessed===apiVersions.length) {
									disposer.dispose();
									utils.showInfo('Successfully fetched API from Postman!');
								}
							});
						}
					});
				})
			}
		});
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
