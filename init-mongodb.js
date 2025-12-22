// Initialize MongoDB database and collections
db = db.getSiblingDB('lists_viewer');

// Create collections with validation and indexes
db.createCollection('lists', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'userId', 'name'],
      properties: {
        _id: { bsonType: 'objectId' },
        userId: { bsonType: 'string' },
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        archived: { bsonType: 'bool' },
        version: { bsonType: 'int' },
        itemCount: { bsonType: 'int' },
        completedCount: { bsonType: 'int' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('items', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'listId', 'type', 'content'],
      properties: {
        _id: { bsonType: 'objectId' },
        listId: { bsonType: 'string' },
        type: { bsonType: 'string', enum: ['item', 'list'] },
        content: { bsonType: 'string' },
        completed: { bsonType: 'bool' },
        quantity: { bsonType: 'int' },
        unit: { bsonType: 'string' },
        order: { bsonType: 'int' },
        version: { bsonType: 'int' },
        archived: { bsonType: 'bool' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'username'],
      properties: {
        _id: { bsonType: 'objectId' },
        username: { bsonType: 'string' },
        iconId: { bsonType: 'string' },
        color: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.lists.createIndex({ userId: 1, archived: 1 });
db.lists.createIndex({ userId: 1, createdAt: -1 });
db.items.createIndex({ listId: 1, archived: 1, order: 1 });
db.items.createIndex({ listId: 1, completed: 1 });
db.users.createIndex({ username: 1 }, { unique: true });

print('Collections and indexes created successfully');
