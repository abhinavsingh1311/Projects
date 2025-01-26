import argparse
from context.db_connection import DatabaseHandler


class CommandHandler:
    def __init__(self):
        self.db = DatabaseHandler()

    def setup_commands(self):
        parser = argparse.ArgumentParser(description='Task Manager')
        subparser = parser.add_subparsers(dest="command", help="Available commands")

        add_parser = subparser.add_parser('add', help="Add a new Task")
        add_parser.add_argument('title', help='Task tile')
        add_parser.add_argument('description', help='Task description')
        add_parser.add_argument('priority', type=int, choices=[1, 2, 3], help='Priority (1=High,2=Medium,3=Low)')
        add_parser.add_argument('due_date',default=None, help='Due date (YYYY-MM-DD)')

        list_parser = subparser.add_parser('list', help='List all tasks')
        list_parser.add_argument('--status', choices=['pending', 'completed'],
                                 help='Filter tasks by status')
        list_parser.add_argument('--priority',type=int,choices=[1,2,3],help='Filter by priority')
        list_parser.add_argument('--sort',choices=[1,2,3],help='Sort tasks by field')

        complete_parser = subparser.add_parser('complete', help='Mark a task as completed')
        complete_parser.add_argument('task_id', type=int, help='ID of the task to complete')

        delete_parser = subparser.add_parser('delete', help='delete a task')
        delete_parser.add_argument('task_id', type=int, help='ID of the task that is to be deleted')

        update_parser = subparser.add_parser('update', help='Update the task details')
        update_parser.add_argument('task_id', type=int, help='ID of the task to update')
        update_parser.add_argument('--title', help='New title')
        update_parser.add_argument('--description', help='New description')
        update_parser.add_argument('--priority', type=int, choices=[1, 2, 3])

        stats_parser = subparser.add_parser('stats',help='Shows task statistics')

        return parser

    # In command_handler.py
    def handle_list_command(self, status=None):
        tasks = self.db.get_all_tasks()
        if not tasks:
            print("No tasks found")
            return

        print("\nTask List:")
        print("-" * 40)
        for task in tasks:
            print(f"ID: {task['id']}")  # Changed 'ID' to 'id'
            print(f"Title: {task['title']}")
            print(f"Description: {task['description']}")
            print(f"Priority: {task['priority']}")
            print(f"Status: {task['status']}")
            if task['due_date']:
                print(f"Due Date: {task['due_date']}")
            print("-" * 40)

    def handle_add_command(self, args):

        task_id = self.db.add_task(args.title, args.description, args.priority)
        print(f"Added task with ID : {task_id}")

    def handle_update_command(self, args):
        self.db.update_task_status(args.task_id, "completed")
        print(f"Marked task {args.task_id} as completed")
