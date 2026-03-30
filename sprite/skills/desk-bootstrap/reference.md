# Desk Bootstrap Reference

## Microlocation Schema

```json
{
  "name": "Haulover Inlet",
  "type": "inlet",
  "notes": "Main ocean access for north Biscayne Bay, strong currents on outgoing tide"
}
```

### Types
| Type | Examples |
|------|----------|
| `harbor` | San Felipe Harbor, Hilo Harbor |
| `island` | Isla Mejia, Key Biscayne |
| `town` | Coconut Grove, San Felipe |
| `anchorage` | Dinner Key, Honeymoon Island |
| `inlet` | Haulover Inlet, Perdido Pass |
| `bay` | Biscayne Bay, Bahia de Los Angeles |
| `lake` | — |
| `river` | Miami River, Colorado River Delta |
| `canal` | Government Cut, ICW |
| `other` | Reef lines, offshore banks |

## Marina Schema

```json
{
  "name": "Crandon Park Marina",
  "type": "full-service",
  "notes": "Key Biscayne, 190 slips, fuel dock, pump-out"
}
```

### Types
| Type | What it means |
|------|---------------|
| `full-service` | Slips, fuel, pump-out, repair |
| `dry-storage` | Rack or yard storage |
| `fuel` | Fuel dock only |
| `ramp` | Public or private boat ramp |
| `yacht-club` | Members-only or semi-private |

## Example: baja-cortez (7 microlocations)

```json
[
  {"name": "San Felipe Harbor", "type": "harbor", "notes": "Main harbor and boat ramp, northern Sea of Cortez"},
  {"name": "Isla Mejia", "type": "island", "notes": "Rocky offshore island 5 miles SE of San Felipe with fishing structure"},
  {"name": "El Muerto Island", "type": "island", "notes": "Rocky island 10 miles north with sea lion haul-outs and yellowtail fishing"},
  {"name": "Punta San Felipe", "type": "harbor", "notes": "Rocky point at harbor mouth, grouper and structure fishing"},
  {"name": "Estero de San Felipe", "type": "bay", "notes": "Protected tidal lagoon south of town, wakeboarding and wildlife"},
  {"name": "Bahia de Los Angeles", "type": "bay", "notes": "Protected bay 200km south, world-class fishing and whale sharks"},
  {"name": "Colorado River Delta", "type": "river", "notes": "Northern extreme of coverage area, tidal estuary"}
]
```

## GoPlaces Commands

```bash
# Search for facilities near desk center
goplaces search "marina" --lat=25.76 --lng=-80.19 --radius-m=25000 --json
goplaces search "boat ramp" --lat=25.76 --lng=-80.19 --radius-m=25000 --json
goplaces search "yacht club" --lat=25.76 --lng=-80.19 --radius-m=15000 --json
goplaces search "fuel dock" --lat=25.76 --lng=-80.19 --radius-m=25000 --json

# Get details on a specific place
goplaces details <placeId> --reviews --json
```

## Swain Desk Commands

```bash
# Read current desk data
swain desk get <your-desk> --json

# Push microlocations and marinas
swain desk update <your-desk> \
  --microlocations='[...]' \
  --marinas='[...]' \
  --status=active \
  --json
```
