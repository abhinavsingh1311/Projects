from datetime import datetime
from dataclasses import dataclass


@dataclass
class Task:
    title: str
    description: str
    priority: int
    due_date: datetime
    status: str = "pending"
    created_at: datetime = datetime.utcnow()

    def __str__(self):
        """String representation of Task"""
        return f"{self.title} (Priority: {self.priority}, Due: {self.due_date.isoformat()})"

    def mark_completed(self):
        """Mark task as completed."""
        self.status = "completed"

    def update_priority(self, priority):
        """Update priority"""
        if priority not in [1, 2, 3]:
            raise ValueError("Priority must be between 1 and 3")
        self.priority = priority


