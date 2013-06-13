.PHONY: code_quality coverage test

all: code_quality coverage

code_quality:
	plato -d code_quality tokenizer.js tool.js ti/styler.js ti/templater.js ti/timplate.js

coverage:
	jscoverage --no-highilght ti ti-cov
	TIMPLATE_COV=1 mocha -R html-cov > coverage.html
	rm -rf ti-cov

test:
	mocha 
