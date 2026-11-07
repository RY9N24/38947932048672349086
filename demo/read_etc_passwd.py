# /etc/passwd принадлежит контейнеру. Файла окружения приложения в нём нет.
with open("/etc/passwd") as file:
    print(file.read())
with open("/app/.env") as file:
    print(file.read())
