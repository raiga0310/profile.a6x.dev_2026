# Python 3.7 以降の修正版
result = group(tasks).apply_async(is_async=True)
task.apply(is_async=False, countdown=10)

# async が予約語になったため引数名をリネーム
