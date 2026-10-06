/// created and updated were autodate, which ignores values sent by the client.
/// Last-write-wins needs the timestamps this app already stores, so they become
/// ordinary date fields. Existing values are copied before the columns change.

const collections = ['clients', 'projects', 'time_entries'];

const updatedIndex = {
	clients: 'CREATE INDEX `idx_clients_user_updated` ON `clients` (`user`, `updated`)',
	projects: 'CREATE INDEX `idx_projects_user_updated` ON `projects` (`user`, `updated`)',
	time_entries:
		'CREATE INDEX `idx_time_entries_user_updated` ON `time_entries` (`user`, `updated`)'
};

function stamp(record, name) {
	const value = record.get(name);
	if (value && typeof value.string === 'function') return value.string();
	return value ? String(value) : '';
}

function readStamps(app, name) {
	const rows = [];
	const batch = 200;
	let offset = 0;
	while (true) {
		const page = app.findRecordsByFilter(name, 'id != ""', 'id', batch, offset);
		for (const record of page) {
			rows.push({
				id: record.id,
				created: stamp(record, 'created'),
				updated: stamp(record, 'updated')
			});
		}
		if (page.length < batch) break;
		offset += page.length;
	}
	return rows;
}

function indexesWithoutUpdated(collection) {
	const kept = [];
	for (const sql of collection.indexes) {
		if (!sql.includes('updated')) kept.push(sql);
	}
	return kept;
}

function replaceTimestampFields(collection, factory) {
	collection.indexes = indexesWithoutUpdated(collection);
	collection.fields.removeByName('created');
	collection.fields.removeByName('updated');
	appSave(collection);
	collection.fields.add(factory('created', false));
	collection.fields.add(factory('updated', true));
	appSave(collection);
}

let appSave = (collection) => {
	throw new Error('app is not ready');
};

function writeStamps(app, name, rows) {
	for (const row of rows) {
		const record = app.findRecordById(name, row.id);
		if (row.created) record.set('created', row.created);
		if (row.updated) record.set('updated', row.updated);
		app.save(record);
	}
}

function dateFields(name, onUpdate) {
	return new DateField({
		name,
		required: false
	});
}

function autodateFields(name, onUpdate) {
	return new AutodateField({
		name,
		onCreate: true,
		onUpdate
	});
}

migrate(
	(app) => {
		appSave = (collection) => app.save(collection);
		for (const name of collections) {
			const saved = readStamps(app, name);
			let collection = app.findCollectionByNameOrId(name);
			replaceTimestampFields(collection, (fieldName) => dateFields(fieldName));
			writeStamps(app, name, saved);
			collection = app.findCollectionByNameOrId(name);
			collection.fields.getByName('created').required = true;
			collection.fields.getByName('updated').required = true;
			const indexes = indexesWithoutUpdated(collection);
			indexes.push(updatedIndex[name]);
			collection.indexes = indexes;
			app.save(collection);
		}
	},
	(app) => {
		appSave = (collection) => app.save(collection);
		for (const name of collections) {
			const saved = readStamps(app, name);
			let collection = app.findCollectionByNameOrId(name);
			replaceTimestampFields(collection, (fieldName, onUpdate) => autodateFields(fieldName, onUpdate));
			writeStamps(app, name, saved);
			collection = app.findCollectionByNameOrId(name);
			const indexes = indexesWithoutUpdated(collection);
			indexes.push(updatedIndex[name]);
			collection.indexes = indexes;
			app.save(collection);
		}
	}
);
