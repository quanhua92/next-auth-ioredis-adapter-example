An example of using `Next Auth` with `ioredis` library to save user data into Redis Server with IORedisAdapter.

`IORedisAdapter` saves data with `Hash` data structure instead of `JSON.stringify` to simplify the management of user data.

For example, a `role` field (`"admin" | "moderator" | "user"`) in User object in [[...nextauth].ts](./pages/api/auth/%5B...nextauth%5D.ts#L20)

- [IORedisAdapter](./lib/IORedisAdapter.ts)

## Getting Started

1. Create an `.env` file work the following content:

    ```text
    REDIS_URL="redis://....."
    GITHUB_CLIENT_ID = ""
    GITHUB_CLIENT_SECRET = ""
    NEXTAUTH_URL="http://localhost:3000"
    NEXTAUTH_SECRET="SOME_SECRET"
    ```

2. Run the server

    ```bash
    npm run dev
    # or
    yarn dev
    ```
