# Contributing

Thanks for your interest in contributing to **@lopatnov/translate-mcp**! Contributions of all kinds are welcome.

## Ways to Contribute

- Report bugs and suggest features via [Issues](https://github.com/lopatnov/translate/issues)
- Fix bugs or implement new features via [Pull Requests](https://github.com/lopatnov/translate/pulls)
- Improve documentation
- Add support for new AI clients

## Getting Started

1. **Fork** the repository on GitHub

2. **Clone** your fork:

   ```bash
   git clone https://github.com/<YOUR-USERNAME>/translate.git
   cd translate/clients/translate-mcp
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start the Lopatnov.Translate gRPC service** (required for manual testing):

   ```bash
   cd ../..
   docker compose -f docker/docker-compose.yml up
   ```

5. **Create a branch** for your changes:

   ```bash
   git checkout -b my-feature
   ```

6. **Make your changes**, then verify the server starts:

   ```bash
   node index.js
   ```

7. **Commit and push:**

   ```bash
   git push -u origin my-feature
   ```

8. **Open a Pull Request** targeting the `dev` branch

## Guidelines

- Keep pull requests focused on a single change
- Write clear commit messages in imperative mood (`feat:`, `fix:`, `docs:`)
- Test against a running Lopatnov.Translate instance before submitting
- Update the README if you add or change tool parameters

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Questions?

Feel free to open an [issue](https://github.com/lopatnov/translate/issues) for any questions.
