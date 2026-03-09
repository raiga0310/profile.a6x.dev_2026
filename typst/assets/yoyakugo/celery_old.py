# Kombu / Celery の典型的な書き方（Python 3.7 以前）
result = group(tasks).apply_async(async=True)
task.apply(async=False, countdown=10)

# async=True でバックグラウンド実行するかどうかを制御
