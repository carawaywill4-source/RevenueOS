# Top-level shortcuts for the persistent operator + sidecar + dashboard trio.
# Prefer `npm run <target>` — the Makefile is a thin alias for muscle memory.

.PHONY: operator-dev operator-start operator-deploy operator-test \
	sidecar-start sidecar-dev sidecar-login sidecar-test \
	dashboard-dev dashboard-build dashboard-start test-all

operator-dev:
	npm run operator:dev

operator-start:
	npm run operator:start

operator-deploy:
	npm run operator:deploy

operator-test:
	npm run operator:test

sidecar-start:
	npm run sidecar:start

sidecar-dev:
	npm run sidecar:dev

# make sidecar-login PLATFORM=hackernews
sidecar-login:
	npm run sidecar:cli -- login $(PLATFORM)

sidecar-test:
	npm run sidecar:test

dashboard-dev:
	npm run dashboard:dev

dashboard-build:
	npm run dashboard:build

dashboard-start:
	npm run dashboard:start

test-all: operator-test sidecar-test
