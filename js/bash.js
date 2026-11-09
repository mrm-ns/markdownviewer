/* Bash 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.bash = [
    // # 注释要求「行首，或左侧只有空白」：shell 里 # 只有作为词首才开始注释，
    // 否则 [root@docker ~]# brctl show 这类 root 提示符会把 # 之后的整条命令
    // 当成注释，表现为前半行正常、后半行整段变灰
    { className: 'comment', pattern: /(?<!\S)#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    // <占位内容>：尖括号自身按符号色、中间内容按变量色（两条规则分工，规则只含非捕获组）。
    // 内容限定「不含空白」是有意的：`echo a > x.txt && echo b > y.txt` 这类重定向链上，
    // 若允许空白，两个 > 之间的整段命令会被当成变量染色，误伤远大于收益。
    // `<<EOF`、`2>&1` 因「< 或 > 紧跟非空白」而不匹配，保持原样。
    { className: 'variable', pattern: /(?<=<)[^\s<>]+(?=>)/ },
    { className: 'bashPrompt', pattern: /^\s*\$[ \t]/ },
    { className: 'bashOption', pattern: /(?:^|\s)(?:-[a-zA-Z][a-zA-Z0-9_-]*|--[a-zA-Z0-9][a-zA-Z0-9_-]*)/ },
    { className: 'symbol', pattern: /[><+*()@!~=|&;{}\[\]:?]/ },
    // 内建命令
	{ className: 'built_in', pattern: /(?<!\S)(?:alias|bg|cd|echo|exit|export|fg|jobs|kill|local|pwd|read|return|source|test|unalias|history)(?!\S)/ },
	// 外部命令（函数名）
	{ className: 'function', pattern: /(?<!\S)(?:ab|apt|apt-get|arp|awk|blkid|cat|chmod|chown|chkconfig|clear|cp|cobbler|curl|dig|dnf|dpkg|egrep|emacs|fdisk|fgrep|find|grep|groupadd|gunzip|gzip|head|hostname|ifconfig|ip|iptables|ipvsadm|iscsiadm|journalctl|keepalived|less|ln|ls|lsblk|lvchange|lvconvert|lvcreate|lvdisplay|lvextend|lvm|lvreduce|lvremove|lvresize|lvscan|mkdir|mkfs|more|mount|mv|nano|netstat|nmap|nohup|nslookup|openssl|pacman|parted|passwd|ping|pkill|ps|pvchange|pvcreate|pvdisplay|pvremove|pvresize|pvs|pvscan|rm|rmdir|route|rpm|rsync|scp|sed|service|ss|ssh|su|sudo|systemctl|systemd-analyze|systemd-cat|tail|tar|targetcli|tcpdump|touch|traceroute|umount|unzip|useradd|userdel|usermod|vgchange|vgconvert|vgcreate|vgdisplay|vgextend|vgreduce|vgremove|vgscan|vi|vim|wget|xz|yum|zip|zcat|gzip|gunzip|zypper|nft|mysql|docker|kubectl)(?!\S)/ },
	// shell 语法关键字
	{ className: 'keyword', pattern: /(?<!\S)(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|add|remove|delete|reload|start|stop|List|get|post|push|pull|put|run|true|false)(?!\S)/ }
  ];

  // Shell 兼容：shell / sh / zsh / ksh / console / terminal 都使用 Bash 规则
  window.MD_SYNTAX_RULES.shell = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.sh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.zsh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.ksh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.console = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.terminal = window.MD_SYNTAX_RULES.bash;

})();
