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

    def get_all_tasks(self, status=None):
        cursor = self.conn.cursor()

        if status:

            cursor.execute('''
            select id,title,description,priority,due_date,status,created_at from tasks
            where status = ?
            ''', (status,))

        else:
            cursor.execute('''
                      select id,title,description,priority,due_date,status,created_at from tasks
                    
                      ''')

        rows = cursor.fetchall()

        tasks = []

        for row in rows:
            task = {
                'id': row[0],
                'title': row[1],
                'description': row[2],
                'priority': row[3],
                'due_date': row[4],
                'status': row[5],
                'created_at': row[6]
            }
            tasks.append(task)

        return tasks

    # In db_connection.py
    def add_task(self, title, description, priority):
        try:
            cursor = self.conn.cursor()
            cursor.execute("""
                INSERT INTO tasks (title, description, priority, status, created_at)
                VALUES (?, ?, ?, 'pending', DATETIME('now'))
                """, (title, description, priority))  # Fixed the syntax error in SQL query
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return None

    def update_task_status(self, task_id, status):
        cursor = self.conn.cursor()
        cursor.execute("""
        UPDATE tasks SET status = ? where id = ? 
        """, (task_id, status))
        self.conn.commit()
