import os
from rq import Worker
from redis import Redis
from .settings import settings, log

# Set environment variable to fix fork() issues on macOS
os.environ.setdefault('OBJC_DISABLE_INITIALIZE_FORK_SAFETY', 'YES')


def start_worker():
    try:
        redis_conn = Redis.from_url(settings.redis_url)
        w = Worker(["default"], connection=redis_conn)
        w.work()
    except Exception as e:
        log.error("Worker failed to start", error=str(e))
        raise


def main():
    start_worker()


if __name__ == "__main__":
    main()