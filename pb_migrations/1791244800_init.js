/// PocketBase 0.23+ migration. Run by the PocketBase binary, not by Node.
///
/// Bool and number fields are non-nullable and zero-default (false and 0).
/// The app treats hourly_rate 0 as "no rate", sends billable: true on create,
/// and treats an empty end_time as a running timer.
/// created and updated are declared here because a custom fields list does not
/// inherit those autodate columns automatically.

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.createRule = null;
		app.save(users);

		const ownerRule = 'user = @request.auth.id';

		const clients = new Collection({
			name: 'clients',
			type: 'base',
			listRule: ownerRule,
			viewRule: ownerRule,
			createRule: ownerRule,
			updateRule: ownerRule,
			deleteRule: ownerRule,
			fields: [
				{
					name: 'user',
					type: 'relation',
					required: true,
					collectionId: users.id,
					maxSelect: 1,
					cascadeDelete: false
				},
				{
					name: 'name',
					type: 'text',
					required: true,
					presentable: true,
					min: 1,
					max: 200
				},
				{
					name: 'color',
					type: 'text',
					max: 32
				},
				{
					name: 'hourly_rate',
					type: 'number',
					min: 0
				},
				{
					name: 'archived',
					type: 'bool'
				},
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE INDEX `idx_clients_user_updated` ON `clients` (`user`, `updated`)']
		});
		app.save(clients);

		const projects = new Collection({
			name: 'projects',
			type: 'base',
			listRule: ownerRule,
			viewRule: ownerRule,
			createRule: ownerRule,
			updateRule: ownerRule,
			deleteRule: ownerRule,
			fields: [
				{
					name: 'user',
					type: 'relation',
					required: true,
					collectionId: users.id,
					maxSelect: 1,
					cascadeDelete: false
				},
				{
					name: 'client',
					type: 'relation',
					required: true,
					collectionId: clients.id,
					maxSelect: 1,
					cascadeDelete: false
				},
				{
					name: 'name',
					type: 'text',
					required: true,
					presentable: true,
					min: 1,
					max: 200
				},
				{
					name: 'hourly_rate',
					type: 'number',
					min: 0
				},
				{
					name: 'archived',
					type: 'bool'
				},
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE INDEX `idx_projects_user_updated` ON `projects` (`user`, `updated`)']
		});
		app.save(projects);

		const timeEntries = new Collection({
			name: 'time_entries',
			type: 'base',
			listRule: ownerRule,
			viewRule: ownerRule,
			createRule: ownerRule,
			updateRule: ownerRule,
			deleteRule: ownerRule,
			fields: [
				{
					name: 'user',
					type: 'relation',
					required: true,
					collectionId: users.id,
					maxSelect: 1,
					cascadeDelete: false
				},
				{
					name: 'project',
					type: 'relation',
					required: true,
					collectionId: projects.id,
					maxSelect: 1,
					cascadeDelete: false
				},
				{
					name: 'start_time',
					type: 'date',
					required: true
				},
				{
					name: 'end_time',
					type: 'date'
				},
				{
					name: 'notes',
					type: 'text',
					max: 5000
				},
				{
					name: 'billable',
					type: 'bool'
				},
				{
					name: 'deleted',
					type: 'bool'
				},
				{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: [
				'CREATE INDEX `idx_time_entries_user_updated` ON `time_entries` (`user`, `updated`)'
			]
		});
		app.save(timeEntries);
	},
	(app) => {
		for (const name of ['time_entries', 'projects', 'clients']) {
			const collection = app.findCollectionByNameOrId(name);
			app.delete(collection);
		}

		const users = app.findCollectionByNameOrId('users');
		users.createRule = '';
		app.save(users);
	}
);
