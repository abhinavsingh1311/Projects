from dataclasses import dataclass
from datetime import datetime
from models.task import Task


def main():
    task = Task(
        title="Complete Python Project",
        description="Build a task management system",
        priority=1,
        due_date=datetime.now(),

    )

    print(f"Task Created :{task.title}")
    print(f"Task Description:{task.description}")
    print(f"Status:{task.status}")

    task.mark_completed()
    print(f"Status after completion : {task.status}")


if __name__ == "__main__":
    main()
