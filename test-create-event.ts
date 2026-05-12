async function test() {
  try {
    const startDateTime = new Date("2026-03-13T12:05:00");
    const endDateTime = new Date("2026-03-13T13:05:00");
    const res = await fetch('http://localhost:3000/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Event',
        description: 'Test',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        member_ids: ['2'],
        recurrence_type: 'none',
        reminder_minutes: 5
      })
    });
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
test();
