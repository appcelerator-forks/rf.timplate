.PHONY: code_quality coverage test

all: code_quality coverage

code_quality:
	plato -d code_quality lib/tokenizer.js lib/css.js tool.js ti/styler.js ti/templater.js ti/timplate.js ti/proxy.js

coverage:
	jscoverage --no-highlight ti ti-cov
	jscoverage --no-highlight lib lib-cov
	TIMPLATE_COV=1 mocha -R html-cov > code_quality/coverage.html; true
	rm -rf ti-cov
	rm -rf lib-cov

test:
	mocha 
