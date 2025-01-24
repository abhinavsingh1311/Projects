from dataclasses import dataclass
from datetime import datetime
from models.task import Task
from cli.command_handler import CommandHandler
from context.db_connection import DatabaseHandler


def main():
    handler = CommandHandler()
    parser = handler.setup_commands()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "add":
        task = Task(
            title=args.title,
            description=args.description,
            priority=args.priority,
            due_date=datetime.now()
        )
        print(f"Added task: {task.title}")

    elif args.command == "list":
        print("Listing tasks...")

    elif args.command == "complete":

        print(f"Marking task {args.task_id} as completed...")

    # task = Task(
    #     title="Complete Python Project",
    #     description="Build a task management system",
    #     priority=1,
    #     due_date=datetime.now(),
    #
    # )
    #
    # print(f"Task Created :{task.title}")
    # print(f"Task Description:{task.description}")
    # print(f"Status:{task.status}")
    #
    # task.mark_completed()
    # print(f"Status after completion : {task.status}")


if __name__ == "__main__":
    main()
