from datetime import datetime


def validate_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise ValueError("Invalid date format: Use YYYY-MM-DD")


def validate_priority(priority):
    if priority not in [1, 2, 3]:
        raise ValueError("Priority must be between 1 and 3")
    return priority
