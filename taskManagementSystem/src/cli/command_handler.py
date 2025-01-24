import argparse
from src.context.db_connection import DatabaseHandler


class CommandHandler:
    def __init__(self):
        self.db = DatabaseHandler()

    def setup_commands(self):
        parser = argparse.ArgumentParser(description='Task Manager')
        parser.add_argument('command', choices=['add', 'list', 'complete'])
        return parser
