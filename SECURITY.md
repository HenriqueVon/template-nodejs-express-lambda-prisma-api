# Security Policy

## Scope

This repository is a **template**. It contains no production data, and its default settings are meant for local development: the sample credentials in `.env.example` and `docker-compose.yml` are placeholders for a throwaway database. A security problem in the template is a problem in the code or in the defaults that every new project inherits, for example a middleware that fails open, an unsafe default in the deploy workflow or a vulnerable dependency.

## Supported versions

Only the latest commit on `main` and the latest release are maintained.

## Reporting a vulnerability

Please **do not open a public issue** for a vulnerability. Use GitHub's private reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it and which files are involved.

You can expect an acknowledgement within a few days. This is a personal project, so there is no guaranteed response time and no bug bounty.

## For projects created from this template

This file belongs to the template and is deleted by `npm run init`. Add your own policy to your project, and keep these in mind from the start:

- Never commit `.env`; configure secrets in the GitHub environments and in your cloud provider.
- Use a long random `API_KEY` (`npm run init` generates one for the local `.env`).
- Review the Dependabot pull requests: they carry the security updates of your dependencies.
