import argparse
from src.context.db_connection import DatabaseHandler


class CommandHandler:
    def __init__(self):
        self.db = DatabaseHandler()

    def setup_commands(self):
        parser = argparse.ArgumentParser(description='Task Manager')
        subparser = parser.add_subparsers(dest="command",help="Available commands")

        add_parser = subparser.add_parser('add',help="Add a new Task")
        add_parser.add_argument('title',help='Task tile')
        add_parser.add_argument('description', help='Task description')
        add_parser.add_argument('priority',type=int,choices=[1,2,3], help='Priority (1=High,2=Medium,3=Low)')
        list_parser= subparser.add_parser('list', help = 'List all tasks')
        list_parser.add_argument('--status', choices=['pending','completed'],
                                 help='Filter tasks by status')

        complete_parser = subparser.add_parser('complete', help='Mark a task as completed')
        complete_parser.add_argument('task_id',type=int,help='ID of the task to complete')

        return parser
