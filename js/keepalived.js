/* Keepalived 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.keepalived = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+\b/ },
    { className: 'literal', pattern: /\b(?:MASTER|BACKUP|NAT|DR|PASS|TCP|LVS_MASTER|LVS_SLAVE)\b/ },
    { className: 'keyword', pattern: /\b(?:global_defs|vrrp_instance|virtual_server|real_server|authentication)\b/ },
    { className: 'built_in', pattern: /\b(?:router_id|state|interface|virtual_router_id|priority|advert_int|auth_type|auth_pass|virtual_ipaddress|delay_loop|lb_algo|lb_kind|persistence_timeout|protocol|weight|connect_timeout|retry|delay_before_retry)\b/ }
  ];
})();
