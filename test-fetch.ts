async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/settings/email-status');
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
