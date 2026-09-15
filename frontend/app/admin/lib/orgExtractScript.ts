/**
 * 그룹웨어 조직도에서 사원 목록을 뽑아 CSV 로 내려받는 스크립트.
 *
 * 관리 > 인원 동기화 화면에서 복사해, 그룹웨어에 로그인한 탭의
 * 개발자 도구 콘솔에 붙여넣고 실행한다.
 *
 * 동작 순서
 *   1. 화면 왼쪽 아래 "조직도" 를 눌러 트리를 연 상태를 전제로 한다.
 *   2. 트리를 모두 펼친다.
 *   3. 사람 노드를 하나씩 눌러 상세 카드에서 사번·이메일·전화를 읽는다.
 *   4. 읽은 내용을 CSV 로 만들어 내려받는다.
 *
 * 카드가 뜨기를 기다릴 때 setTimeout 대신 MutationObserver 를 쓴다.
 * 탭이 백그라운드면 브라우저가 타이머를 초당 한 번으로 늦춰서,
 * 타이머로 기다리면 백 명 읽는 데 십 분이 넘게 걸린다.
 */
export const ORG_EXTRACT_SCRIPT = String.raw`(async () => {
  const CENTER = '${'$'}{CENTER}';   // 뽑을 센터 이름. 전체를 받으려면 빈 문자열로.

  const $ = window.jQuery;
  const tree = document.querySelector('.jstree');
  if (!$ || !tree) {
    alert('조직도 트리를 찾지 못했습니다.\n왼쪽 아래 "조직도" 를 먼저 누른 뒤 다시 실행해 주세요.');
    return;
  }

  // 1) 트리 전체 펼치기
  $('.jstree').jstree('open_all');
  await new Promise((r) => setTimeout(r, 2500));

  const text = (li) => {
    const a = li.querySelector(':scope > a');
    return (a ? a.textContent : '').trim();
  };

  // 2) 사람 노드 + 부서 경로 모으기
  const nodes = [...document.querySelectorAll('.jstree li')]
    .filter((li) => /^(MASTER|MEMBER)_/.test(li.id))
    .map((li) => {
      const path = [];
      let p = li.parentElement ? li.parentElement.closest('li') : null;
      while (p) {
        if (/^org_/.test(p.id)) path.unshift(text(p));
        p = p.parentElement ? p.parentElement.closest('li') : null;
      }
      return { id: li.id, label: text(li), path: path.join(' > ') };
    })
    .filter((n) => !CENTER || n.path.includes(CENTER));

  if (nodes.length === 0) {
    alert('대상 인원을 찾지 못했습니다. 센터 이름을 확인해 주세요: ' + CENTER);
    return;
  }
  console.log('[조직도] 대상 ' + nodes.length + '명. 읽는 중...');

  // 3) 상세 카드 읽기
  const readCard = () => {
    const out = {};
    for (const el of document.querySelectorAll('th,dt,.tit,.label,span,strong')) {
      const t = el.textContent.trim();
      if (t === '인식번호(사번)' || t === '휴대전화') {
        let v = el.nextElementSibling;
        if (!v && el.parentElement) v = el.parentElement.nextElementSibling;
        if (v) out[t] = v.innerText.trim().replace(/\s+/g, ' ');
      }
    }
    const info = document.querySelector('.wrap_list_info');
    out.head = info ? info.innerText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    return out;
  };

  // 타이머가 아니라 DOM 변화로 기다린다 (백그라운드 탭에서도 빠르게)
  const waitCard = (want, ms) =>
    new Promise((res) => {
      let obs = null;
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        if (obs) obs.disconnect();
        res(v);
      };
      const check = () => {
        const c = readCard();
        if (c.head && c.head[0] && c.head[0].startsWith(want) && c['인식번호(사번)']) {
          done(c);
          return true;
        }
        return false;
      };
      if (check()) return;
      obs = new MutationObserver(check);
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      setTimeout(() => done(null), ms);
    });

  const people = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    const a = document.querySelector('#' + CSS.escape(n.id) + ' > a');
    if (a) {
      a.click();
      const card = await waitCard(n.label.split(' ')[0], 8000);
      const m = n.label.match(/^(.+?)\s+(\S+)$/);
      const segs = n.path.split(' > ');
      people.push({
        idnum: card ? (card['인식번호(사번)'] || '') : '',
        name: m ? m[1] : n.label,
        center: segs.find((s) => s.endsWith('센터')) || '',
        office: segs.find((s) => s.endsWith('실')) || '',
        team: segs.find((s) => s.endsWith('팀')) || '',
        position: m ? m[2] : '',
        email: card ? (card.head.find((x) => x.includes('@')) || '') : '',
        phone: card ? (card['휴대전화'] || '') : '',
      });
    }
    if ((i + 1) % 20 === 0) console.log('[조직도] ' + (i + 1) + '/' + nodes.length);
  }

  // 4) 사번 기준으로 중복 제거 후 CSV 만들기 (겸직이면 트리에 두 번 나온다)
  const seen = new Set();
  const rows = people.filter((p) => {
    if (!p.idnum || seen.has(p.idnum)) return false;
    seen.add(p.idnum);
    return true;
  });
  const missing = people.length - rows.length;

  const head = ['idnum', 'name', 'center', 'office', 'team', 'position', 'email', 'phone'];
  const esc = (v) => (String(v || '').includes(',') ? '"' + v + '"' : String(v || ''));
  const csv = [head.join(',')]
    .concat(rows.map((r) => head.map((k) => esc(r[k])).join(',')))
    .join('\n');

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'org_' + stamp + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  console.log('[조직도] 완료: ' + rows.length + '명 저장' + (missing ? ' (중복·누락 ' + missing + '건 제외)' : ''));
  alert(rows.length + '명을 CSV 로 내려받았습니다.\n관리 > 인원 동기화에서 올려 주세요.');
})();`;

/** 화면에 보여줄 때 센터 이름을 끼워 넣는다. */
export function buildOrgExtractScript(center: string): string {
  return ORG_EXTRACT_SCRIPT.replace('${CENTER}', center);
}
