import sqlite3
from src.models.task import Task


class DatabaseHandler:

    def __init__(self):
        self.conn = sqlite3.connect('tasks.db')
        self.create_tables()

    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS tasks (
                       id INTEGER PRIMARY KEY AUTOINCREMENT,
                       title TEXT NOT NULL,
                       description TEXT NOT NULL,
                       priority INTEGER,
                       due_date TEXT,
                       status TEXT,
                       created_at TEXT
                       )
                       ''')
        self.conn.commit()
