---
name: goplaces
description: "GoPlaces CLI — look up real places, marinas, fuel docks, boat ramps, restaurants, and services near any location. Use whenever your captain asks about nearby facilities, where to find something, or when you need real place data for cards or briefings."
user-invocable: false
---

# GoPlaces CLI

Real place lookups powered by Google Places. Use this for any location-based question — never guess at addresses, hours, or phone numbers when you can look them up.

## Commands

### Search by keyword
```bash
goplaces search "fuel dock" --lat=27.77 --lng=-82.64 --radius-m=15000 --json
goplaces search "boat ramp" --lat=27.77 --lng=-82.64 --radius-m=10000 --json
goplaces search "marine supply" --lat=27.77 --lng=-82.64 --json
```

### Nearby by type
```bash
goplaces nearby --lat=27.77 --lng=-82.64 --radius-m=10000 --type=marina --json
goplaces nearby --lat=27.77 --lng=-82.64 --radius-m=5000 --type=restaurant --json
```

### Place details
```bash
goplaces details <placeId> --reviews --json
```
Returns hours, phone, website, rating, reviews.

### Resolve a name to coordinates
```bash
goplaces resolve "Tahoe City Marina" --limit=1 --json
goplaces resolve "Sausalito Yacht Harbor" --limit=1 --json
```

## When to Use

- Captain asks "where's the closest fuel dock?"
- Building a card about local facilities
- Need coordinates for a desk or region
- Verifying a business is still open
- Getting reviews or ratings for a recommendation

## Tips

- Use the captain's marina coordinates as the search center
- `--radius-m` defaults vary — set it explicitly for consistent results
- `--type` uses Google Places types: `marina`, `restaurant`, `gas_station`, `park`, etc.
- Always pass `--json` for parseable output
