/// Adds an optional project color. An empty value means the project uses its client color.
/// PocketBase text fields store "" rather than null.

migrate(
	(app) => {
		const projects = app.findCollectionByNameOrId('projects');
		projects.fields.add(
			new TextField({
				name: 'color',
				max: 32
			})
		);
		app.save(projects);
	},
	(app) => {
		const projects = app.findCollectionByNameOrId('projects');
		projects.fields.removeByName('color');
		app.save(projects);
	}
);
