OWASP ZAP baseline CI (suggested):

docker run --rm -t owasp/zap2docker-stable zap-baseline.py -t http://app:9999 -r zap-report.html -x zap-report.xml -I -m 5



