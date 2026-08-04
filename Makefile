# Makefile targets invoked by the tutor-mfe image build.

.PHONY: pull_translations requirements

# tutor-mfe runs `make pull_translations` during the MFE image build (atlas i18n).
# This app has no strings externalized to openedx/openedx-translations yet, so
# this is a safe no-op that just ensures the messages directory exists. When
# strings are externalized later, replace this with the standard atlas pull.
pull_translations:
	@mkdir -p src/i18n/messages
	@echo "edl-panel: no external translations to pull; skipping atlas."

requirements:
	npm ci
