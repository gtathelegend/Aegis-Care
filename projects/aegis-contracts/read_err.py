import codecs
content = codecs.open('deploy_err.txt', 'r', 'utf-16le').read()
content = content.replace('\r', '')
open('deploy_err_clean.txt', 'w', encoding='utf-8').write(content)
