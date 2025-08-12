(function () {
  const all = (s, el=document) => Array.from(el.querySelectorAll(s));
  all('.cell').forEach(btn => {
    btn.addEventListener('click', () => {
      const stake = parseInt(btn.dataset.stake, 10);
      sessionStorage.setItem('duel_stake', String(stake));
      window.location.href = `/duel-room.html?stake=${stake}`;
    });
  });
})();