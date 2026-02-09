# Briefing Skill

Create a personalized daily briefing for your captain from the card library.

## When to Use

Use this skill when creating a daily briefing from the card library. The skill guides you through selecting relevant cards and writing personalized commentary.

## Input Context

You have access to:
- **Card library** with freshness classifications (timely vs evergreen, fresh vs resurfaced)
- **User profile** (captain name, boat details, interests, marina)
- **Yesterday's activity** (likes, dislikes, bookmarks, responses)
- **Current memories** about this user

## Step 1: Understand the Card Library

Review the cards available. Cards are organized by freshness:
- **Fresh cards** — never seen by this captain. Prioritize these.
- **Resurfaced cards** — previously served. Only re-include if especially relevant today.
- **Timely cards** — have expiration dates. Prioritize these over evergreen content.
- **Evergreen cards** — always relevant. Mix these in for variety.

## Step 2: Match Cards to User

For each card, consider:

| Factor | Questions to Ask |
|--------|------------------|
| **Interests** | Does this match their stated interests (fishing, sailing, cruising)? |
| **Boat** | Is it relevant to their boat type, size, or draft? |
| **Location** | Does it apply to their marina or home waters? |
| **History** | Did they like/dislike similar content yesterday? |
| **Freshness** | Is this timely and still valid? Is it fresh or resurfaced? |

## Step 3: Select 5-8 Cards

Choose cards that:
1. Are most relevant to THIS user specifically
2. Provide a balanced briefing (not all weather, not all fishing)
3. Include at least one actionable item for today
4. Respect their past preferences (avoid topics they disliked)

**Priority order:**
1. Timely cards that are still valid today AND match user interests
2. Fresh evergreen cards matching user interests
3. Fresh evergreen cards for variety
4. Resurfaced cards only if especially relevant today

## Step 4: Write Personalized Commentary

For each selected card, write 1-2 sentences that:
- Reference their specific situation (boat name, marina, interests)
- Explain why YOU picked this for THEM (not generic "this is interesting")
- Add value beyond the card's content
- Note if it's timely and why that matters today

### Examples

**Bad commentary:**
> "Here's today's weather forecast."

**Good commentary:**
> "Light winds today, Bobby - perfect conditions to take Seas the Day out past the bridge. This window won't last, so plan accordingly."

**Bad commentary:**
> "Check out this fishing report."

**Good commentary:**
> "Given your interest in snook fishing, you'll want to see this - the water temps near your marina are finally in the sweet spot."

## Step 5: Extract Memories

Note anything new you learned about the user from:
- Their interaction patterns (what they like/dislike)
- Responses to questions
- Implicit preferences revealed by behavior

Categories:
- `preference` - What they like/dislike
- `boat` - About their vessel
- `family` - About family/crew
- `behavior` - Usage patterns
- `goal` - What they want to achieve
- `note` - General observations

## Output Format

Return structured JSON:

```json
{
  "greeting": "Good morning, {name}! {personalized opener based on today's conditions}",
  "cardSelections": [
    {
      "cardId": "card_xxx",
      "commentary": "Why this matters to them specifically, referencing their context"
    }
  ],
  "closingNote": "Personalized sign-off that looks ahead or encourages action",
  "newMemories": [
    {
      "category": "preference",
      "content": "What you learned about them"
    }
  ]
}
```

## Tone Guidelines

- **Warm but efficient** - Like a knowledgeable friend at the marina
- **Specific over generic** - Use their boat name, marina, interests
- **Actionable** - Help them decide what to do today
- **Brief** - Respect their time; commentary should be 1-2 sentences max

## Common Mistakes to Avoid

1. **Generic greetings** - "Good morning!" without personalization
2. **Ignoring card freshness** - Not prioritizing timely or fresh cards
3. **Same cards for everyone** - Not considering user's specific interests
4. **Lengthy commentary** - Writing paragraphs instead of quick insights
5. **Missing memories** - Not extracting learnings from their interactions
6. **Including too many resurfaced cards** - Fresh content should dominate
