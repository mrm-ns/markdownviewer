/* Bash 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.bash = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'bashPrompt', pattern: /^\s*\$[ \t]/ },
    { className: 'bashOption', pattern: /(?:^|\s)(?:-[a-zA-Z][a-zA-Z0-9_-]*|--[a-zA-Z0-9][a-zA-Z0-9_-]*)/ },
    { className: 'symbol', pattern: /[><+*()@!~=|&;{}\[\]:?]/ },
    { className: 'keyword', pattern: /(?<!\S)(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|local|read|cd|source|sudo|dnf|yum|apt|apt-get|dpkg|rpm|pacman|zypper|vim|vi|nano|emacs|grep|egrep|fgrep|sed|awk|cat|less|more|tail|head|ip|ifconfig|netstat|ping|traceroute|curl|wget|nmap|tcpdump|ss|route|arp|hostname|dig|nslookup|ssh|scp|rsync|cobbler|ipvsadm|keepalived|openssl|systemctl|journalctl|systemd-analyze|systemd-cat|pvcreate|pvdisplay|pvs|pvscan|pvremove|pvchange|pvresize|vgcreate|vgdisplay|vgs|vgscan|vgremove|vgchange|vgextend|vgreduce|vgconvert|lvcreate|lvdisplay|lvs|lvscan|lvremove|lvchange|lvextend|lvreduce|lvresize|lvconvert|lvm|mkfs|mount|umount|blkid|lsblk|fdisk|parted|ls|pwd|cp|mv|rm|mkdir|rmdir|touch|chmod|chown|ln|tar|unzip|zip|gzip|gunzip|xz|ps|kill|pkill|jobs|bg|fg|nohup|service|chkconfig|useradd|usermod|userdel|groupadd|passwd|su|history|clear|alias|unalias|test|ab|iptables|iscsiadm|targetcli)(?!\S)/ }
  ];

  // Shell 兼容：shell / sh / zsh / ksh / console / terminal 都使用 Bash 规则
  window.MD_SYNTAX_RULES.shell = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.sh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.zsh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.ksh = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.console = window.MD_SYNTAX_RULES.bash;
  window.MD_SYNTAX_RULES.terminal = window.MD_SYNTAX_RULES.bash;

})();
