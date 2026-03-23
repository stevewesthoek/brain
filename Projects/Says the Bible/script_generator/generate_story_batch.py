from __future__ import annotations

import math
import re
from pathlib import Path


ROOT = Path("/Users/Office/Repos/Personal/Brain/Projects/Says the Bible/script_generator")
OUT = ROOT / "generated_ssml"
TEMPLATE = (ROOT / "azure-ssml-template.ssml").read_text(encoding="utf-8")

BREAKS = {
    "P0": 250,
    "P1": 500,
    "P2": 1000,
    "P3": 1800,
    "P4": 3800,
    "P5": 9000,
}

RATES = {
    "01": (-10.00, -2.00),
    "02": (-10.50, -2.25),
    "03": (-10.75, -2.40),
    "04": (-11.00, -2.60),
    "05": (-11.25, -2.80),
    "06": (-11.50, -3.00),
    "07": (-11.75, -3.10),
    "08": (-13.00, -3.40),
    "09": (-13.50, -3.60),
    "10": (-14.50, -4.00),
    "11": (-15.00, -4.00),
    "12": (-15.50, -4.00),
}


def br(key: str) -> str:
    return f'<break time="{BREAKS[key]}ms"/>'


def line(text: str, pause: str) -> str:
    return f"      {text}{br(pause)}"


def wrap(content: str, rate: float, pitch: float) -> str:
    body = TEMPLATE.replace("{{CONTENT}}", content)
    body = body.replace('rate="-12.00%"', f'rate="{rate:.2f}%"', 1)
    body = body.replace('pitch="-3.00%"', f'pitch="{pitch:.2f}%"', 1)
    return body


def build_entry(topic: dict) -> str:
    lines = [
        line("Take a slow breath in.", "P1"),
        line("And let it out.", "P2"),
        line("Again, breathe in.", "P1"),
        line("And breathe out.", "P3"),
        line("Let your shoulders loosen.", "P1"),
        line("Let your forehead soften.", "P2"),
        line("There is nothing you need to prove right now.", "P3"),
    ]
    for text, pause in topic["entry"]:
        lines.append(line(text, pause))
    lines.extend(
        [
            line("You do not need to rush ahead of the words.", "P1"),
            line("You can simply listen and receive.", "P2"),
            line("You do not have to hold every detail in your mind.", "P1"),
            line("You can let the story carry you slowly.", "P3"),
        ]
    )
    return "\n".join(lines)


UNIT_SETTLING = [
    "The story begins with God's steady hand already at work.",
    "The Lord is already present before the outcome is seen.",
    "Nothing in this scene is outside God's rule.",
    "The turning point comes by God's faithfulness.",
    "The Lord continues to care after the crisis.",
    "The story settles in the gift of God's presence.",
]


def build_unit(unit: dict, index: int) -> str:
    lines = [line(text, pause) for text, pause in unit["narrative"]]
    lines.append(line(UNIT_SETTLING[index], "P2"))
    lines.extend(
        [
            line(unit["observation"], "P2"),
            line(unit["meaning"], "P2"),
            line(unit["personal"], "P3"),
            line("You can rest.", "P4"),
        ]
    )
    return "\n".join(lines)


def build_integration(topic: dict) -> str:
    lines = [
        line("Now the story can become simple.", "P3"),
        line("No new scene is needed.", "P3"),
        line("The same truth remains.", "P3"),
        line("The Lord is still faithful.", "P3"),
    ]
    for text in topic["integration_1"]:
        lines.append(line(text, "P3"))
    lines.extend(
        [
            line(topic["identity"], "P4"),
            line(topic["safety"], "P4"),
            line("You do not have to carry anything more from the story.", "P4"),
            line("You can rest.", "P4"),
        ]
    )
    return "\n".join(lines)


def build_integration_2(topic: dict) -> str:
    lines = [
        line("Nothing new is being added now.", "P3"),
        line("The truth can become lighter and simpler.", "P3"),
    ]
    lines.extend(line(text, pause) for text, pause in topic["integration_2"])
    lines.extend(
        [
            line(topic["identity"], "P4"),
            line("You can let the night be quiet.", "P4"),
        ]
    )
    return "\n".join(lines)


def build_wave_1(phrases: list[str], cycles: int = 3) -> str:
    lines: list[str] = []
    for _ in range(cycles):
        lines.extend(
            [
                line(phrases[0], "P3"),
                line(phrases[1], "P3"),
                line(phrases[2], "P4"),
                line(phrases[3], "P3"),
                line(phrases[4], "P3"),
                line(phrases[5], "P4"),
            ]
        )
        lines.append("")
    return "\n".join(lines).strip()


def build_wave_2(phrases: list[str], cycles: int = 3) -> str:
    lines: list[str] = []
    for _ in range(cycles):
        lines.extend(
            [
                line(phrases[0], "P4"),
                line(phrases[1], "P5"),
                line(phrases[2], "P4"),
                line(phrases[3], "P5"),
                line(phrases[4], "P4"),
                line(phrases[5], "P5"),
            ]
        )
        lines.append("")
    return "\n".join(lines).strip()


def build_wave_3(phrases: list[str], cycles: int) -> str:
    lines: list[str] = []
    for _ in range(cycles):
        for phrase in phrases:
            lines.append(line(phrase, "P5"))
        lines.append("")
    return "\n".join(lines).strip()


def estimate_minutes(ssml: str) -> float:
    rate_match = re.search(r'<prosody[^>]*\brate="([+-]?[0-9]+(?:\.[0-9]+)?)%"', ssml)
    rate = float(rate_match.group(1)) if rate_match else 0.0
    breaks = [int(x) for x in re.findall(r'<break\s+time="(\d+)ms"\s*/>', ssml)]
    no_comments = re.sub(r"<!--.*?-->", " ", ssml, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", no_comments)
    words = [word for word in re.split(r"\s+", text.strip()) if word]
    wpm = 150.0 * max(0.2, 1.0 + rate / 100.0)
    speech_sec = (len(words) / wpm) * 60.0
    total_sec = speech_sec + sum(breaks) / 1000.0
    return total_sec / 60.0


TOPICS = [
    {
        "folder": "005_exodus_moses",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-baby-and-basket.ssml",
                "narrative": [
                    ("In the opening of Moses' life, Egypt is a place where fear has become policy, and Pharaoh commands that the Hebrew baby boys should be thrown into the Nile.", "P1"),
                    ("A Levite mother hides her son for three months, and when she can hide him no longer, she makes a basket of reeds, coats it with bitumen and pitch, and sets it among the reeds by the riverbank.", "P2"),
                    ("His sister stands at a distance to know what will happen, and Pharaoh's daughter comes down to bathe, sees the basket, opens it, and looks on the crying child with compassion.", "P1"),
                    ("The child is one of the Hebrews, yet mercy arrives where power had spoken death, and the sister steps forward to ask whether a Hebrew woman should nurse the boy for her.", "P1"),
                    ("So the child's own mother is called, the boy is kept alive, and when he grows, he is brought to Pharaoh's daughter, who names him Moses because she drew him out of the water.", "P2"),
                    ("His life begins under threat, and yet the hand of God is already quietly preserving what Pharaoh cannot stop.", "P3"),
                ],
                "observation": "Moses is drawn out of danger before he can do anything for himself.",
                "meaning": "The story begins with God preserving life in the middle of oppression.",
                "personal": "You are not beyond the notice of God's care.",
            },
            {
                "file": "03-burning-bush.ssml",
                "narrative": [
                    ("Years later Moses is keeping the flock of Jethro in the wilderness, and he comes to Horeb, the mountain of God, where he sees a bush that burns without being consumed.", "P1"),
                    ("He turns aside to see this great sight, and from the bush the Lord calls his name, saying, Moses, Moses, and Moses answers, Here I am.", "P1"),
                    ("God tells him not to come near, but to take off his sandals, because the place where he is standing is holy ground.", "P2"),
                    ("Then the Lord speaks plainly: He has seen the affliction of His people in Egypt, heard their cry, and knows their sufferings.", "P1"),
                    ("He has come down to deliver them and to bring them into a good and broad land, and Moses is told that he will be sent to Pharaoh.", "P1"),
                    ("When Moses asks the name of the One who sends him, God answers with steady mystery, I AM WHO I AM, and promises, I will be with you.", "P3"),
                ],
                "observation": "At the bush, Moses learns that God sees, hears, knows, and comes near.",
                "meaning": "Deliverance begins with the presence of the Lord, not with the strength of the servant.",
                "personal": "You are not asked to carry what only God can carry.",
            },
            {
                "file": "04-pharaoh-and-plagues.ssml",
                "narrative": [
                    ("Moses and Aaron stand before Pharaoh with a simple command from the Lord, Let My people go, that they may hold a feast to Me in the wilderness.", "P1"),
                    ("Pharaoh hardens himself and answers with contempt, saying he does not know the Lord and will not let Israel go.", "P1"),
                    ("Then the signs unfold across Egypt: the Nile turns to blood, frogs cover the land, gnats and flies fill the air, livestock fall, boils rise, hail strikes, locusts consume, and darkness can be felt.", "P2"),
                    ("Again and again the Lord distinguishes between Egypt and Goshen, between judgment and protection, showing that He rules what Pharaoh thought he controlled.", "P1"),
                    ("The contest is not between equal powers, and it is not uncertain who rules the river, the sky, the field, the body, and the night.", "P1"),
                    ("Through every plague the Lord is making Himself known, and every refusal from Pharaoh only sharpens the truth that no throne can resist God forever.", "P3"),
                ],
                "observation": "Pharaoh resists, but the Lord steadily reveals His power over every part of creation.",
                "meaning": "The God of Israel is not limited by empire, fear, or delay.",
                "personal": "You do not need to mistake delay for absence.",
            },
            {
                "file": "05-passover-and-exodus.ssml",
                "narrative": [
                    ("Before the final night, the Lord gives Israel careful instructions for Passover, telling each household to take a lamb without blemish and to mark the doorposts with its blood.", "P1"),
                    ("They are to eat in haste, with sandals on their feet and staffs in their hands, because the Lord is about to bring them out.", "P1"),
                    ("At midnight the firstborn in Egypt die, from the house of Pharaoh to the captive in the dungeon, and there is a great cry in the land, for there is not a house without someone dead.", "P2"),
                    ("Then Pharaoh calls for Moses and Aaron by night and tells them to rise up and go, and the people of Israel leave with their kneading bowls wrapped in their cloaks before the dough has leavened.", "P1"),
                    ("They plunder the Egyptians as the Lord had said, and the night becomes a night of watching, remembered through generations as the Lord brought His people out.", "P1"),
                    ("Israel leaves not by accident and not by human permission alone, but because the Lord keeps His word and brings them out with a mighty hand.", "P3"),
                ],
                "observation": "The night of Passover becomes the turning point from slavery toward freedom.",
                "meaning": "What God promises, He brings to completion in His own time.",
                "personal": "You are not trapped beyond the reach of God's deliverance.",
            },
            {
                "file": "06-sea-and-wilderness.ssml",
                "narrative": [
                    ("When Israel stands by the sea and Pharaoh's army draws near behind them, the people are afraid and cry out, seeing water ahead and chariots behind.", "P1"),
                    ("Moses tells them not to fear, but to stand firm and see the salvation of the Lord, for the Egyptians they see that day they shall never see again.", "P1"),
                    ("The angel of God moves behind the camp, the pillar of cloud stands between Israel and Egypt, and the Lord drives the sea back by a strong east wind all night.", "P2"),
                    ("The waters part, the people pass through on dry ground, and when the Egyptians pursue, the waters return and cover the chariots and horsemen.", "P1"),
                    ("Later, in the wilderness, the people are given manna from heaven, water from the rock, and the daily reminder that their life will be sustained by the Lord who brought them out.", "P1"),
                    ("The journey is not empty after rescue, because the same God who opens a path also provides bread, water, and guidance along the way.", "P3"),
                ],
                "observation": "The Lord makes a path where there was no path and gives provision where there was no storehouse.",
                "meaning": "Deliverance is followed by daily care, not abandonment.",
                "personal": "You can trust God for the next step as well as the great rescue.",
            },
            {
                "file": "07-sinai-and-presence.ssml",
                "narrative": [
                    ("In the wilderness Israel comes to Sinai, and the mountain trembles with thunder, cloud, trumpet sound, and the holy nearness of God.", "P1"),
                    ("There the Lord speaks covenant words to the people, calling them to belong to Him and to walk in the way that matches His holiness.", "P1"),
                    ("Moses goes up the mountain and receives the pattern for worship, the tabernacle, the priesthood, and the signs that God's dwelling will be in the midst of His people.", "P2"),
                    ("Even after Israel sins with the golden calf, Moses pleads that the Lord's presence must go with them, because without that presence they cannot truly be carried onward.", "P1"),
                    ("The Lord answers that His presence will go and that He will give rest, and the cloud of glory later covers the tabernacle so fully that the dwelling place itself is filled with His glory.", "P1"),
                    ("Exodus settles not only on escape from bondage, but on the deeper gift that God chooses to dwell among the people He has redeemed.", "P3"),
                ],
                "observation": "The story comes to rest in the promise of God's presence with His people.",
                "meaning": "The greatest gift in Exodus is not only freedom, but the Lord Himself drawing near.",
                "personal": "You are not asked to walk without the presence of God.",
            },
        ],
        "entry": [
            ("Tonight we will move slowly through the book of Exodus, following the life of Moses.", "P1"),
            ("We will hear how God sees the afflicted, speaks from the fire, brings His people out, and stays with them in the wilderness.", "P2"),
            ("This is a story of deliverance, but it is also a story of presence.", "P1"),
            ("The Lord does not forget the cries that rise to Him.", "P1"),
            ("The Lord does not lose the people He has chosen to keep.", "P2"),
            ("And as the story slows, the same steady truth will remain: God sees, God hears, and God stays.", "P3"),
        ],
        "integration_1": [
            "God saw the affliction of His people.",
            "God heard their cry.",
            "God remembered His covenant.",
            "God brought them out with a mighty hand.",
            "God gave bread in the wilderness.",
            "God chose to dwell among them.",
        ],
        "integration_2": [
            ("God sees.", "P3"),
            ("God hears.", "P3"),
            ("God remembers.", "P3"),
            ("God leads.", "P3"),
            ("God stays with His people.", "P4"),
            ("You are not forgotten before Him.", "P4"),
            ("You are safe in God's care.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "God sees and hears.",
            "God brings His people through.",
            "You are not forgotten before Him.",
            "His presence goes with you.",
            "His care does not fail.",
            "You can rest.",
        ],
        "identity": "You are not forgotten before Him.",
        "safety": "You are safe in God's care.",
    },
    {
        "folder": "006_jonah_whale",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-call-and-flight.ssml",
                "narrative": [
                    ("The word of the Lord comes to Jonah son of Amittai with a clear command: arise, go to Nineveh, that great city, and call out against it, for its evil has come up before God.", "P1"),
                    ("But Jonah rises to flee to Tarshish from the presence of the Lord, going down to Joppa, finding a ship, paying the fare, and stepping aboard to go far in the opposite direction.", "P2"),
                    ("The movement of the story is deliberate: Jonah goes down to the port, down into the ship, and later down into the inner part of it, as if his body is tracing the refusal in his heart.", "P1"),
                    ("Nothing in the text suggests confusion about what God asked, because the command is plain and the flight is equally plain.", "P1"),
                    ("Jonah does not outrun the Lord by distance, and he does not change the Lord's word by turning away from it.", "P1"),
                    ("The book begins with a prophet who hears clearly, resists clearly, and is still met by the God from whom no sea journey can hide him.", "P3"),
                ],
                "observation": "Jonah flees from the Lord, but the Lord is already present on the road Jonah chooses.",
                "meaning": "Disobedience changes Jonah's direction, but it does not remove God's pursuit.",
                "personal": "You are not beyond the reach of God's searching mercy.",
            },
            {
                "file": "03-storm-at-sea.ssml",
                "narrative": [
                    ("The Lord hurls a great wind upon the sea, and there is a mighty tempest, so that the ship threatens to break apart under the violence of the storm.", "P1"),
                    ("The mariners are afraid, each cries out to his own god, and they hurl cargo into the sea to lighten the vessel, while Jonah has gone down below and lies fast asleep.", "P1"),
                    ("The captain wakes him with a question sharpened by fear: What do you mean, you sleeper? Arise, call out to your god. Perhaps the god will give a thought to us, that we may not perish.", "P2"),
                    ("Then the sailors cast lots to know on whose account the evil has come, and the lot falls on Jonah, drawing hidden rebellion into the open.", "P1"),
                    ("Asked who he is, Jonah confesses that he is a Hebrew and that he fears the Lord, the God of heaven, who made the sea and the dry land.", "P1"),
                    ("The irony is heavy and calm at the same time: the sea itself is proving that Jonah cannot escape the Maker of the sea.", "P3"),
                ],
                "observation": "The storm exposes what Jonah hoped to keep hidden.",
                "meaning": "God's dealings with Jonah are not random; they are purposeful and direct.",
                "personal": "Even hard interruption can be a form of mercy.",
            },
            {
                "file": "04-overboard-and-fish.ssml",
                "narrative": [
                    ("When the sailors ask what they should do, Jonah tells them to hurl him into the sea, because he knows the storm has come on their account because of him.", "P1"),
                    ("At first they row hard to get back to dry land, unwilling to cast him overboard, but the sea grows more and more tempestuous against them.", "P1"),
                    ("So they call to the Lord, asking not to perish for this man's life, and then they throw Jonah into the sea.", "P2"),
                    ("Immediately the sea ceases from its raging, and the men fear the Lord exceedingly, offering sacrifice and making vows.", "P1"),
                    ("Then the Lord appoints a great fish to swallow Jonah, and Jonah is in the belly of the fish three days and three nights.", "P1"),
                    ("The great fish is not presented as chaos without purpose, but as an appointed instrument held inside the command of God.", "P3"),
                ],
                "observation": "The sea grows calm at God's word, and the fish comes at God's appointment.",
                "meaning": "Judgment and preservation stand together in the Lord's hands.",
                "personal": "Even in a place you would never choose, God is still able to keep you.",
            },
            {
                "file": "05-prayer-in-depths.ssml",
                "narrative": [
                    ("From the belly of the fish Jonah prays to the Lord his God, and his prayer sounds like someone who has gone to the depth and discovered that God was already listening there.", "P1"),
                    ("He says that out of the belly of Sheol he cried, and the Lord heard his voice; the waters closed in over him, weeds were wrapped about his head, and he went down to the roots of the mountains.", "P2"),
                    ("Yet even there Jonah speaks of the Lord bringing up his life from the pit, and he remembers the Lord when his life is fainting away.", "P1"),
                    ("The prayer moves from drowning imagery toward renewed worship, and Jonah says that salvation belongs to the Lord.", "P1"),
                    ("At the end of the prayer, the Lord speaks to the fish, and it vomits Jonah out upon the dry land.", "P1"),
                    ("The same God who appointed the fish also appoints Jonah's return to the surface, to land, and to the unfinished call.", "P3"),
                ],
                "observation": "Jonah is heard from the depth, not only from the shore.",
                "meaning": "There is no depth where the Lord stops hearing the cry that turns toward Him.",
                "personal": "You are not unheard in the deep place.",
            },
            {
                "file": "06-nineveh-and-repentance.ssml",
                "narrative": [
                    ("The word of the Lord comes to Jonah the second time, giving the same command to arise and go to Nineveh, and this time Jonah goes according to the word of the Lord.", "P1"),
                    ("Nineveh is an exceedingly great city, and Jonah enters it, calling out that in forty days Nineveh shall be overthrown.", "P1"),
                    ("Then something astonishing happens: the people of Nineveh believe God, proclaim a fast, and put on sackcloth, from the greatest of them to the least of them.", "P2"),
                    ("Even the king rises from his throne, covers himself with sackcloth, sits in ashes, and calls for all to turn from evil and violence.", "P1"),
                    ("When God sees what they do, how they turn from their evil way, He relents of the disaster He said He would do to them, and He does not do it.", "P1"),
                    ("The Lord who pursued Jonah across the sea is the same Lord who extends mercy to a city that turns at His warning.", "P3"),
                ],
                "observation": "Nineveh turns when God speaks, and God responds with mercy.",
                "meaning": "The Lord's warnings are not empty threats; they are calls that leave room for repentance.",
                "personal": "God's mercy is larger than your instinct to limit it.",
            },
            {
                "file": "07-plant-and-mercy.ssml",
                "narrative": [
                    ("Jonah is displeased that God has shown mercy, and he sits east of the city, making a booth and waiting to see what will become of Nineveh.", "P1"),
                    ("Then the Lord appoints a plant to come up over Jonah, giving him shade and easing his discomfort, and Jonah is exceedingly glad because of the plant.", "P1"),
                    ("But at dawn God appoints a worm that attacks the plant, so that it withers, and then He appoints a scorching east wind and the hot sun beats on Jonah's head.", "P2"),
                    ("Jonah pities the plant that came in a night and perished in a night, and the Lord asks whether Jonah should not also pity Nineveh, where more than one hundred and twenty thousand persons do not know their right hand from their left, and also much cattle.", "P1"),
                    ("The book ends with God's question hanging in the air, not because God lacks clarity, but because Jonah and the listener are meant to sit inside the wideness of divine mercy.", "P1"),
                    ("Jonah is a short book, yet it rests on a large truth: the Lord is compassionate, purposeful, and free in His mercy.", "P3"),
                ],
                "observation": "The final lesson is not about the plant, but about the mercy of God.",
                "meaning": "God cares for people Jonah would rather see judged, and His compassion is not cramped by human resentment.",
                "personal": "You can rest under the mercy of God rather than trying to measure it.",
            },
        ],
        "entry": [
            ("Tonight we will move through the short book of Jonah, slowly enough to notice both the storm and the mercy inside it.", "P1"),
            ("This is not mainly a story about a whale, because the book itself says a great fish appointed by God.", "P1"),
            ("It is a story about the word of the Lord, the resistance of Jonah, the turning of Nineveh, and the compassion of God.", "P2"),
            ("The sea cannot hide Jonah.", "P1"),
            ("The deep cannot silence Jonah.", "P1"),
            ("And the mercy of God reaches further than Jonah expected.", "P3"),
        ],
        "integration_1": [
            "The Lord spoke.",
            "Jonah fled.",
            "The Lord pursued.",
            "The Lord heard from the deep.",
            "Nineveh turned.",
            "The Lord showed mercy.",
        ],
        "integration_2": [
            ("God is present on the sea.", "P3"),
            ("God is present in the deep.", "P3"),
            ("God is present in the city.", "P3"),
            ("His mercy is not small.", "P3"),
            ("You are not beyond His reach.", "P4"),
            ("You are safe under His mercy.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "The Lord is near on the sea.",
            "The Lord is near in the deep.",
            "His mercy is wider than fear.",
            "You are not beyond His reach.",
            "His word still stands.",
            "You can rest.",
        ],
        "identity": "You are not beyond His reach.",
        "safety": "You are safe under His mercy.",
    },
    {
        "folder": "007_mark_storm",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-evening-crossing.ssml",
                "narrative": [
                    ("In Mark's Gospel the storm story begins with a quiet sentence at the close of day: Jesus says to His disciples, Let us go across to the other side.", "P1"),
                    ("The crowd is left behind, He is taken just as He is in the boat, and other boats are with them on the water.", "P1"),
                    ("Nothing in the opening scene sounds dramatic, because the danger has not yet risen into view.", "P1"),
                    ("It is simply evening, a boat, a crossing, and the presence of Jesus among His disciples.", "P2"),
                    ("The command to cross already contains the shape of the journey, because they are going where He has said they will go.", "P1"),
                    ("Before the waves are described, the story is already resting on the words of Jesus.", "P3"),
                ],
                "observation": "The crossing begins with the calm authority of Jesus speaking a direction.",
                "meaning": "The story starts with His word before it reaches the wind.",
                "personal": "You can remember His word before you measure the waves.",
            },
            {
                "file": "03-waves-and-sleep.ssml",
                "narrative": [
                    ("Then a great windstorm arises, and the waves are breaking into the boat, so that the boat is already filling with water.", "P1"),
                    ("Mark tells the scene with plain force: water entering, wind rising, the vessel taking on what it cannot safely hold.", "P1"),
                    ("And in the stern Jesus is asleep on the cushion, not frantic, not pacing, not startled by what has startled everyone else.", "P2"),
                    ("His sleep does not mean He is absent from the boat; it means the storm has not undone His peace.", "P1"),
                    ("The contrast is severe and memorable: the disciples are overwhelmed by what surrounds them, while Jesus remains at rest inside the same storm.", "P1"),
                    ("Mark places the sleeping Christ in the middle of the violent scene so that the reader will see calm before calm is spoken.", "P3"),
                ],
                "observation": "Jesus is present in the storm before the storm is quieted.",
                "meaning": "His rest is not fragile, and His presence is not cancelled by fear.",
                "personal": "You are not alone when the scene around you feels full and loud.",
            },
            {
                "file": "04-master-do-you-care.ssml",
                "narrative": [
                    ("The disciples wake Him with a question that gathers panic into one sentence: Teacher, do You not care that we are perishing?", "P1"),
                    ("It is an honest question, but it is also a frightened one, because fear often treats delay as indifference and silence as absence.", "P1"),
                    ("The disciples are not inventing the danger; the water is real and the wind is real, yet their interpretation of Jesus is not steady.", "P2"),
                    ("They see the waves correctly, but they do not yet see Him correctly.", "P1"),
                    ("Mark allows the question to stand in the open, because many readers know the feeling of asking whether the Lord cares when trouble has risen high.", "P1"),
                    ("The beauty of the story is that Jesus answers the storm and the fear without leaving the boat or leaving the disciples in their confusion.", "P3"),
                ],
                "observation": "The disciples speak from fear, and Jesus receives that fearful cry inside the boat.",
                "meaning": "The presence of panic does not remove the possibility of help.",
                "personal": "You do not need to hide fear before bringing it to Christ.",
            },
            {
                "file": "05-peace-be-still.ssml",
                "narrative": [
                    ("Jesus awakes, rebukes the wind, and says to the sea, Peace. Be still. The command is short, but the authority behind it is immeasurable.", "P1"),
                    ("Then the wind ceases, and there is a great calm. Mark does not describe a gradual settling, but a decisive obedience in creation itself.", "P2"),
                    ("The same voice that had called the disciples into the boat now addresses the sea, and the sea obeys.", "P1"),
                    ("The storm is not persuaded and it is not negotiated with; it is rebuked.", "P1"),
                    ("What the disciples could not master with effort, Christ masters with a word.", "P1"),
                    ("This is one of the reasons the story feels so restful once it slows: the power that rules the sea is standing inside the boat with them.", "P3"),
                ],
                "observation": "Jesus speaks, and the sea yields to Him.",
                "meaning": "The Lord over the storm is greater than the storm itself.",
                "personal": "You are held by One whose word creation obeys.",
            },
            {
                "file": "06-why-are-you-afraid.ssml",
                "narrative": [
                    ("After the great calm, Jesus turns to His disciples and asks, Why are you so afraid? Have you still no faith?", "P1"),
                    ("The question comes after rescue, not before it, as if He is now teaching them to interpret what has happened in the light of who He is.", "P1"),
                    ("Fear had made the storm the largest reality in the boat, but Jesus exposes another reality that was there the whole time: His own presence and authority.", "P2"),
                    ("Faith in this moment is not a denial of waves, but a right estimate of the One who shares the boat.", "P1"),
                    ("The disciples had seen His works already, yet this storm reveals that there is still more to learn about Him than they had yet understood.", "P1"),
                    ("The question remains gentle enough to hear at night: what if the first thing to remember is not the size of the trouble, but the nearness of Christ?", "P3"),
                ],
                "observation": "Jesus addresses fear by drawing attention back to Himself.",
                "meaning": "Faith grows when His presence is given its proper weight.",
                "personal": "You can let His nearness become larger than your alarm.",
            },
            {
                "file": "07-great-calm.ssml",
                "narrative": [
                    ("The disciples are filled with great fear and say to one another, Who then is this, that even the wind and the sea obey Him?", "P1"),
                    ("Mark ends the scene not with a tidy explanation, but with reverent awe, because the storm has revealed something deeper than danger and rescue alone.", "P1"),
                    ("The One in the boat is not only a teacher with wise sayings; He is the Lord whose command reaches the forces that terrify human beings.", "P2"),
                    ("The water becomes quiet, but the bigger stillness comes from seeing more truly who Jesus is.", "P1"),
                    ("Once that truth is seen, the storm story becomes more than memory; it becomes a place of trust, because the disciples now know more clearly who is with them.", "P1"),
                    ("Mark lets the great calm remain in the air, and it is enough for the story to end there, with Christ revealed and the sea made still.", "P3"),
                ],
                "observation": "The story ends in awe before the One whom the wind and the sea obey.",
                "meaning": "Peace in Mark four is grounded in the identity of Jesus.",
                "personal": "You are safe with the One who commands the storm.",
            },
        ],
        "entry": [
            ("Tonight we stay inside one short story from the Gospel of Mark, the evening crossing when the storm rose and Jesus calmed the sea.", "P1"),
            ("Because the passage is short, we can move through it slowly enough to feel its quiet weight.", "P1"),
            ("The scene begins in a boat and ends in a great calm.", "P2"),
            ("The disciples are afraid.", "P1"),
            ("Jesus is present.", "P1"),
            ("And His word is enough for the water and enough for the heart.", "P3"),
        ],
        "integration_1": [
            "Jesus spoke the crossing.",
            "Jesus remained in the boat.",
            "Jesus heard the fearful cry.",
            "Jesus rebuked the sea.",
            "Jesus asked about fear.",
            "Jesus left a great calm.",
        ],
        "integration_2": [
            ("He is with you in the boat.", "P3"),
            ("He is not absent in the storm.", "P3"),
            ("His word is not weak.", "P3"),
            ("The sea obeys Him.", "P3"),
            ("You are safe with Christ.", "P4"),
            ("You can rest in His peace.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "Jesus is with you in the boat.",
            "His peace is not shaken.",
            "The wind and sea obey Him.",
            "You are safe with Christ.",
            "The great calm remains.",
            "You can rest.",
        ],
        "identity": "You are safe with Christ.",
        "safety": "You can rest in His peace.",
    },
    {
        "folder": "008_luke_nativity",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-annunciation.ssml",
                "narrative": [
                    ("In Luke's Gospel the nativity begins with the angel Gabriel being sent from God to a virgin betrothed to a man named Joseph, of the house of David, and the virgin's name is Mary.", "P1"),
                    ("Gabriel greets her as one who has found favour with God, and Mary is troubled at the saying, trying to discern what sort of greeting this might be.", "P1"),
                    ("The angel tells her not to be afraid, because she will conceive and bear a son and call His name Jesus.", "P2"),
                    ("He will be great, will be called the Son of the Most High, and the Lord God will give to Him the throne of His father David.", "P1"),
                    ("When Mary asks how this will be, Gabriel answers that the Holy Spirit will come upon her and that the child to be born will be called holy, the Son of God.", "P1"),
                    ("Mary replies with surrender rather than control: Behold, I am the servant of the Lord; let it be to me according to your word.", "P3"),
                ],
                "observation": "The story opens with God's word arriving to Mary before the child is seen.",
                "meaning": "The nativity begins with promise, favour, and the faithful word of God.",
                "personal": "You can rest in what God speaks before you see the full outcome.",
            },
            {
                "file": "03-mary-and-elizabeth.ssml",
                "narrative": [
                    ("Mary rises and goes with haste into the hill country to the house of Zechariah and Elizabeth, carrying the promise in her body and the angel's words in her mind.", "P1"),
                    ("When Elizabeth hears Mary's greeting, the baby leaps in her womb, and Elizabeth is filled with the Holy Spirit.", "P1"),
                    ("She blesses Mary among women and blesses the fruit of her womb, calling her the mother of her Lord.", "P2"),
                    ("Mary answers with praise, magnifying the Lord and rejoicing in God her Saviour, because He has looked on the humble estate of His servant.", "P1"),
                    ("Luke lets joy move through this meeting without noise or hurry, as if the promised child is already making hearts alive before He is born.", "P1"),
                    ("Mary remains there about three months, and the waiting is filled not with emptiness, but with remembered promise and quiet praise.", "P3"),
                ],
                "observation": "Before Bethlehem, there is a household filled with recognition and praise.",
                "meaning": "The coming of Jesus brings joy before the world fully knows His name.",
                "personal": "You can let quiet praise hold the waiting season.",
            },
            {
                "file": "04-bethlehem-road.ssml",
                "narrative": [
                    ("In those days a decree goes out from Caesar Augustus that all the world should be registered, and Joseph goes up from Galilee to Judea, to the city of David called Bethlehem.", "P1"),
                    ("Mary goes with him, because she is betrothed to Joseph and is with child, and the imperial decree becomes the road by which Scripture's place is quietly met.", "P1"),
                    ("Luke does not dramatize the journey with extra detail; he simply shows the obedience of ordinary travel under the providence of God.", "P2"),
                    ("They arrive in Bethlehem, and while they are there, the time comes for her to give birth.", "P1"),
                    ("The story moves with surprising stillness: a long promise, a government decree, a journey, and then the hour appointed by God.", "P1"),
                    ("Even before the child is laid in a manger, the nativity shows that God works through roads, timings, and places that human beings do not fully arrange.", "P3"),
                ],
                "observation": "Bethlehem is reached in the ordinary movement of travel and time.",
                "meaning": "The Lord guides history toward His promise without strain.",
                "personal": "You do not need to manage every road for God to be faithful on it.",
            },
            {
                "file": "05-manger-and-child.ssml",
                "narrative": [
                    ("Mary gives birth to her firstborn son, wraps Him in swaddling cloths, and lays Him in a manger, because there was no place for them in the guest room.", "P1"),
                    ("Luke's wording is simple and careful, and the simplicity itself becomes part of the wonder.", "P1"),
                    ("The promised Son of the Most High enters the world in humility, wrapped by His mother and laid where animals were fed.", "P2"),
                    ("The throne promised by Gabriel is not denied by the manger; it is simply hidden beneath humility at the beginning.", "P1"),
                    ("No human arrangement makes the child less who He is, and no lowly setting reduces the glory of what God has done.", "P1"),
                    ("The nativity asks the listener to slow down enough to see holiness in smallness, majesty in meekness, and promise in an infant lying still.", "P3"),
                ],
                "observation": "Jesus is born in humility, yet His identity remains unchanged.",
                "meaning": "God comes near without display and without losing glory.",
                "personal": "You can rest knowing God's nearness does not require worldly grandeur.",
            },
            {
                "file": "06-shepherds-and-angels.ssml",
                "narrative": [
                    ("In the same region there are shepherds out in the field, keeping watch over their flock by night, and an angel of the Lord appears to them.", "P1"),
                    ("The glory of the Lord shines around them and they are filled with great fear, but the angel says, Fear not, for behold, I bring you good news of great joy for all the people.", "P2"),
                    ("For unto you is born this day in the city of David a Saviour, who is Christ the Lord, and the sign is specific: a baby wrapped in swaddling cloths and lying in a manger.", "P1"),
                    ("Suddenly there is with the angel a multitude of the heavenly host praising God and saying, Glory to God in the highest, and on earth peace among those with whom He is pleased.", "P1"),
                    ("When the angels go away, the shepherds say to one another that they must go to Bethlehem and see this thing that has happened, which the Lord has made known to them.", "P1"),
                    ("The night field becomes a place of revelation, not because the shepherds were powerful, but because God delights to announce His Son to those who watch in the dark.", "P3"),
                ],
                "observation": "The announcement of Jesus comes with fear not and with news of joy and peace.",
                "meaning": "The birth of Christ is good news given by God and made known to ordinary watchers in the night.",
                "personal": "The Lord knows how to bring peace into the dark place.",
            },
            {
                "file": "07-treasured-things.ssml",
                "narrative": [
                    ("The shepherds go with haste and find Mary and Joseph, and the baby lying in a manger, exactly as the angel had said.", "P1"),
                    ("After seeing Him, they make known the saying that had been told them concerning this child, and all who hear wonder at what the shepherds tell them.", "P1"),
                    ("But Mary treasures up all these things, pondering them in her heart, and the shepherds return, glorifying and praising God for all they had heard and seen.", "P2"),
                    ("Luke lets the story settle in wonder, memory, and praise rather than noise.", "P1"),
                    ("The child has been announced, seen, and treasured, and the nativity rests in that gentle pattern of revelation received and held.", "P1"),
                    ("It is fitting that the story slows with Mary pondering, because the coming of Jesus is not only to be proclaimed, but also quietly kept in the heart.", "P3"),
                ],
                "observation": "Luke lets the nativity rest in treasuring, pondering, and praise.",
                "meaning": "The right response to the birth of Jesus is wonder that remembers.",
                "personal": "You can let the peace of Christ settle slowly within you.",
            },
        ],
        "entry": [
            ("Tonight we will listen to the nativity in the Gospel of Luke, letting the story arrive at the pace Luke gives it.", "P1"),
            ("An angel speaks.", "P1"),
            ("A young woman believes.", "P1"),
            ("A child is born in Bethlehem.", "P1"),
            ("Shepherds hear good news by night.", "P2"),
            ("And the whole story rests on this quiet wonder: God has come near in Jesus Christ.", "P3"),
        ],
        "integration_1": [
            "The Lord sent His word to Mary.",
            "The child was born in Bethlehem.",
            "He was laid in a manger.",
            "The angels announced peace.",
            "The shepherds came and saw.",
            "Mary treasured these things in her heart.",
        ],
        "integration_2": [
            ("God has come near.", "P3"),
            ("The child is Christ the Lord.", "P3"),
            ("Peace was spoken in the night.", "P3"),
            ("The promise was fulfilled.", "P3"),
            ("You are safe in the peace of Christ.", "P4"),
            ("You can rest in His nearness.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "God has come near in Christ.",
            "Peace was spoken in the night.",
            "The child is Christ the Lord.",
            "You are safe in His peace.",
            "Mary treasured these things.",
            "You can rest.",
        ],
        "identity": "You are safe in the peace of Christ.",
        "safety": "You can rest in His nearness.",
    },
    {
        "folder": "009_psalms_rest",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-lie-down-in-peace.ssml",
                "narrative": [
                    ("Psalm four ends the day with a sentence that has carried many weary hearts into the night: In peace I will both lie down and sleep; for You alone, O Lord, make me dwell in safety.", "P1"),
                    ("The Psalm does not deny pressure, but it chooses where the final weight will rest.", "P1"),
                    ("Sleep is described not as self-produced control, but as something received in safety from the Lord.", "P2"),
                    ("To lie down in peace is already a form of trust, because the body admits that keeping the world is not its calling.", "P1"),
                    ("The Lord alone makes His servant dwell in safety, and the word alone matters, because no rival protector is needed beside Him.", "P1"),
                    ("Psalm four is a doorway into rest, simple and strong, ending the day not with noise, but with peace given by God.", "P3"),
                ],
                "observation": "Psalm four joins lying down, sleeping, and safety in the Lord.",
                "meaning": "Rest is received as a gift of God's keeping presence.",
                "personal": "You do not have to hold the night together yourself.",
            },
            {
                "file": "03-green-pastures-still-waters.ssml",
                "narrative": [
                    ("Psalm twenty three speaks of the Lord as Shepherd, and one of the first movements of that Psalm is toward green pastures and still waters.", "P1"),
                    ("These are not frantic images and they are not crowded images; they are the places where a creature is fed and calmed under attentive care.", "P1"),
                    ("He makes me lie down in green pastures, David says, and that verb makes is gentle authority, not harsh force.", "P2"),
                    ("The Shepherd leads beside still waters, because rest needs both provision and quiet, both enoughness and calm.", "P1"),
                    ("The Psalm teaches the heart to imagine the Lord not as distant from fatigue, but as the One who leads the tired body into a place of settled care.", "P1"),
                    ("When the Psalms speak of rest, they often do so with images of nearness and guidance rather than self-created escape.", "P3"),
                ],
                "observation": "The Shepherd leads toward places where rest can be received.",
                "meaning": "God's rest is not empty silence alone; it is cared-for stillness.",
                "personal": "You are safe in the Shepherd's leading.",
            },
            {
                "file": "04-be-still.ssml",
                "narrative": [
                    ("Psalm forty six speaks in the middle of upheaval, naming earth that gives way, mountains that move, and waters that roar and foam.", "P1"),
                    ("Yet in the centre of that shaking world comes the command, Be still, and know that I am God.", "P1"),
                    ("Stillness in this Psalm is not based on pretending the troubles are absent; it comes from knowing who God is in the middle of them.", "P2"),
                    ("The Lord of hosts is with us, the Psalm says. The God of Jacob is our fortress.", "P1"),
                    ("So stillness is not vacancy; it is the soul settling under divine reality stronger than the shaking world.", "P1"),
                    ("This Psalm allows rest to exist alongside turbulence because God's presence does not depend on outward calm first.", "P3"),
                ],
                "observation": "Psalm forty six places stillness in the knowledge of God's rule and presence.",
                "meaning": "The command to be still rests on who God is, not on perfect conditions.",
                "personal": "You can become quiet beneath the steadiness of God.",
            },
            {
                "file": "05-wait-in-silence.ssml",
                "narrative": [
                    ("Psalm sixty two speaks in the language of quiet waiting: For God alone my soul waits in silence; from Him comes my salvation.", "P1"),
                    ("The Psalm repeats that posture more than once, as though the soul must be taught to return there again and again.", "P1"),
                    ("He alone is my rock and my salvation, my fortress; I shall not be greatly shaken.", "P2"),
                    ("The repetition is part of the gift, because the heart often needs truth to come more than once before it begins to settle under it.", "P1"),
                    ("Waiting in silence is not useless passivity in the Psalms; it is directed expectancy anchored in God's character.", "P1"),
                    ("Psalm sixty two slows the inner life by giving it one place to lean and one source from which help truly comes.", "P3"),
                ],
                "observation": "The Psalm repeats quiet waiting because the soul learns rest by returning.",
                "meaning": "Silence becomes safe when it is silence before God.",
                "personal": "You can let your soul wait without forcing an outcome tonight.",
            },
            {
                "file": "06-weaned-child.ssml",
                "narrative": [
                    ("Psalm one hundred and thirty one is small, but its stillness is deep. The Psalmist says his heart is not lifted up and his eyes are not raised too high.", "P1"),
                    ("He does not occupy himself with things too great and too marvellous for him, and then comes the image that has soothed many listeners: a weaned child with its mother.", "P1"),
                    ("Like a weaned child with its mother, so is my soul within me.", "P2"),
                    ("The image is not frantic dependence, but quiet closeness, a presence where hunger has softened and striving has gone quiet.", "P1"),
                    ("Psalm one hundred and thirty one gives permission to stop reaching for what is beyond our size and to rest instead in humble nearness.", "P1"),
                    ("That childlike stillness is not immaturity; it is a mature refusal to carry what belongs to God alone.", "P3"),
                ],
                "observation": "The Psalm offers the image of a soul quieted like a weaned child with its mother.",
                "meaning": "Rest grows where pride lowers and nearness is enough.",
                "personal": "You can release what is too high for you and become quiet before God.",
            },
            {
                "file": "07-gives-sleep.ssml",
                "narrative": [
                    ("Psalm one hundred and twenty seven reminds us that anxious labour is not the same thing as fruitful keeping.", "P1"),
                    ("Unless the Lord builds the house, those who build it labour in vain. Unless the Lord watches over the city, the watchman stays awake in vain.", "P1"),
                    ("It is vain, the Psalm says, to rise early and go late to rest, eating the bread of anxious toil; for He gives to His beloved sleep.", "P2"),
                    ("The line is not a contempt for work, but a rebuke to sleepless self-reliance, the kind that acts as though everything depends on our watching.", "P1"),
                    ("The beloved of the Lord is allowed to sleep because the Lord Himself does not cease from keeping.", "P1"),
                    ("This Psalm gives the night back to God and returns the body to the dignity of rest.", "P3"),
                ],
                "observation": "Psalm one hundred and twenty seven sets anxious toil against the gift of sleep from God.",
                "meaning": "Rest is possible because the Lord keeps watch without weariness.",
                "personal": "You are allowed to sleep while God remains faithful.",
            },
        ],
        "entry": [
            ("Tonight we are not following one narrative scene, but moving through the Psalms where rest is spoken in many gentle ways.", "P1"),
            ("The Psalms speak of lying down in peace.", "P1"),
            ("They speak of still waters and quiet waiting.", "P1"),
            ("They speak of a weaned child and the gift of sleep.", "P2"),
            ("Again and again the same truth returns.", "P1"),
            ("Rest is possible because God remains steady.", "P3"),
        ],
        "integration_1": [
            "In peace you may lie down and sleep.",
            "The Shepherd leads beside still waters.",
            "Be still and know that He is God.",
            "Your soul may wait in silence for Him.",
            "He gives sleep to His beloved.",
            "You may become quiet before Him.",
        ],
        "integration_2": [
            ("God remains steady.", "P3"),
            ("His care does not sleep.", "P3"),
            ("His peace is not fragile.", "P3"),
            ("You are safe in His keeping.", "P4"),
            ("You do not need to strive tonight.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "The Lord gives peace.",
            "The Lord gives rest.",
            "His care does not sleep.",
            "You are safe in His keeping.",
            "The night belongs to God.",
            "You can rest.",
        ],
        "identity": "You are safe in His keeping.",
        "safety": "You do not need to strive tonight.",
    },
    {
        "folder": "010_psalms_protection",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-refuge-and-shield.ssml",
                "narrative": [
                    ("The Psalms often speak of protection not as an abstract idea, but as refuge, shield, rock, and dwelling place.", "P1"),
                    ("Psalm three says, You, O Lord, are a shield about me, my glory, and the lifter of my head.", "P1"),
                    ("A shield is close, not distant. It belongs in the space where danger would otherwise strike.", "P2"),
                    ("The Psalmist does not claim to be fearless by temperament; he confesses the Lord as the one who surrounds and keeps him.", "P1"),
                    ("Again and again in the Psalms, protection is not first about the strength of the worshipper, but about the nearness of God around the worshipper.", "P1"),
                    ("The image of shield teaches the heart that divine care can be both personal and present.", "P3"),
                ],
                "observation": "The Lord is described as a shield around His servant.",
                "meaning": "Protection in the Psalms is close, surrounding care from God Himself.",
                "personal": "You do not stand unguarded before the Lord.",
            },
            {
                "file": "03-keeper-of-israel.ssml",
                "narrative": [
                    ("Psalm one hundred and twenty one lifts the eyes toward the hills and then answers the anxious question directly: My help comes from the Lord, who made heaven and earth.", "P1"),
                    ("The Psalm says He will not let your foot be moved, and He who keeps you will not slumber.", "P1"),
                    ("Behold, He who keeps Israel will neither slumber nor sleep.", "P2"),
                    ("The comfort is not merely that God is strong, but that His keeping does not lapse, drift, or grow drowsy.", "P1"),
                    ("The Lord is your keeper, the Psalm says, and the repetition makes the truth settle more deeply.", "P1"),
                    ("Protection here is wakeful, unbroken, and free from the frailty that belongs to human watchmen.", "P3"),
                ],
                "observation": "The Keeper of Israel does not slumber or sleep.",
                "meaning": "God's protection does not weaken in the night.",
                "personal": "You may sleep because God does not.",
            },
            {
                "file": "04-shadow-of-wings.ssml",
                "narrative": [
                    ("Another Psalm image is softer and no less strong: the shadow of God's wings.", "P1"),
                    ("Psalm seventeen asks to be hidden in the shadow of Your wings, and Psalm fifty seven says, In the shadow of Your wings I will take refuge, till the storms of destruction pass by.", "P1"),
                    ("Wings are not stone walls, yet the Psalms use them to speak of tenderness, nearness, and gathered safety.", "P2"),
                    ("The image is protective without being harsh, as though the Lord's care covers as well as defends.", "P1"),
                    ("When destruction passes by, the refuge is not found in pretending the storm is unreal, but in being sheltered under God.", "P1"),
                    ("This winged imagery allows protection to feel both powerful and gentle at the same time.", "P3"),
                ],
                "observation": "The Psalms picture refuge as being hidden beneath God's wings.",
                "meaning": "Divine protection can be both strong and tender.",
                "personal": "You are allowed to seek shelter rather than pretending not to need it.",
            },
            {
                "file": "05-fortress-and-stronghold.ssml",
                "narrative": [
                    ("Psalm eighteen calls the Lord my rock and my fortress and my deliverer, my God, my rock, in whom I take refuge.", "P1"),
                    ("Psalm thirty one says, You are my rock and my fortress, and for Your name's sake You lead me and guide me.", "P1"),
                    ("A fortress in the Psalms is not merely defensive architecture; it is a way of naming stability that cannot be easily shaken.", "P2"),
                    ("The Lord is not only shelter after impact; He is the solid place from which the heart can stop sliding.", "P1"),
                    ("The language of rock, refuge, and stronghold gives heaviness and permanence to the promise of protection.", "P1"),
                    ("When the Psalms repeat these words, they are teaching the soul where true solidity is found.", "P3"),
                ],
                "observation": "The Lord is named as rock, fortress, and stronghold.",
                "meaning": "Protection includes stability, not only escape.",
                "personal": "You can lean your weight on God without fear of collapse.",
            },
            {
                "file": "06-fear-by-night.ssml",
                "narrative": [
                    ("Psalm ninety one gathers many fears into one long sheltering song, beginning with the one who dwells in the shelter of the Most High and abides in the shadow of the Almighty.", "P1"),
                    ("The Psalm speaks of deliverance from snare and pestilence, of faithfulness as shield and buckler, and of not fearing the terror of the night or the arrow that flies by day.", "P2"),
                    ("Its language is sweeping and vivid, not because life never feels exposed, but because the Lord is presented as the true refuge in every hour.", "P1"),
                    ("The terror of the night is named without being allowed the final word.", "P1"),
                    ("Again the Psalm returns to dwelling, abiding, and resting beneath the protection of God rather than scrambling for safety elsewhere.", "P1"),
                    ("Protection here is not panic-driven; it is dwelling-driven, remaining under the Lord who is refuge.", "P3"),
                ],
                "observation": "Psalm ninety one names danger yet places the worshipper beneath God's shelter.",
                "meaning": "Protection is strongest when the heart learns to dwell in God as refuge.",
                "personal": "You do not have to be ruled by what prowls in the dark.",
            },
            {
                "file": "07-kept-paths.ssml",
                "narrative": [
                    ("Psalm one hundred and twenty one ends with a promise that the Lord will keep your going out and your coming in from this time forth and forevermore.", "P1"),
                    ("Protection in the Psalms is not only for one dramatic moment; it is also for movement, return, daily path, and ordinary life.", "P1"),
                    ("The Lord keeps the foot, the soul, the entrance, and the departure.", "P2"),
                    ("Psalm one hundred and thirty nine says that even darkness is not dark to God, and that He hems us in behind and before.", "P1"),
                    ("Taken together, these Psalms teach that no direction of travel places a person outside the knowing care of the Lord.", "P1"),
                    ("The protected life in Scripture is not a life beyond all trial, but a life kept by God on every road given to it.", "P3"),
                ],
                "observation": "The Psalms speak of God keeping the whole path, both going out and coming in.",
                "meaning": "The Lord's protection reaches beyond one hour and covers the whole way.",
                "personal": "You are kept by God on the road and in the room.",
            },
        ],
        "entry": [
            ("Tonight we will listen to the Psalms speak about protection in the many images they use for God's keeping care.", "P1"),
            ("Shield.", "P1"),
            ("Keeper.", "P1"),
            ("Shadow of wings.", "P1"),
            ("Rock and refuge.", "P2"),
            ("The language changes, but the truth does not: the Lord keeps His people.", "P3"),
        ],
        "integration_1": [
            "The Lord is your shield.",
            "The Lord is your keeper.",
            "The Lord covers with His wings.",
            "The Lord is your rock and refuge.",
            "You need not fear the terror of the night.",
            "He keeps your going out and your coming in.",
        ],
        "integration_2": [
            ("The Lord keeps you.", "P3"),
            ("The Lord does not sleep.", "P3"),
            ("The Lord is your refuge.", "P3"),
            ("You are not unguarded.", "P4"),
            ("You are safe in His keeping.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "The Lord is your keeper.",
            "The Lord is your refuge.",
            "His care does not sleep.",
            "You are guarded.",
            "You are safely kept.",
            "You can rest.",
        ],
        "identity": "You are not unguarded.",
        "safety": "You are safe in His keeping.",
    },
    {
        "folder": "011_matthew_light",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-star-in-the-east.ssml",
                "narrative": [
                    ("Matthew begins his light imagery around Jesus' birth with wise men from the east arriving in Jerusalem and asking where the child has been born king of the Jews.", "P1"),
                    ("They say they saw His star when it rose and have come to worship Him.", "P1"),
                    ("A light in the sky becomes a sign that sends seekers on the road toward the child.", "P2"),
                    ("Matthew does not ask us to explain every detail of the star before we receive its function in the story: it is a God-given guide toward Christ.", "P1"),
                    ("Herod is troubled, Jerusalem is troubled with him, but the star belongs to another kind of kingdom and another kind of rule.", "P1"),
                    ("The first light in Matthew's story of Jesus is a light that points beyond itself to the One who is to be worshipped.", "P3"),
                ],
                "observation": "The star leads the wise men toward the child who is king.",
                "meaning": "Light in Matthew first serves the revelation of Christ.",
                "personal": "You can follow the light that points toward Jesus.",
            },
            {
                "file": "03-star-over-the-child.ssml",
                "narrative": [
                    ("After hearing the Scriptures read by the chief priests and scribes, the wise men go on their way, and the star they saw when it rose goes before them.", "P1"),
                    ("It comes to rest over the place where the child is, and when they see the star they rejoice exceedingly with great joy.", "P1"),
                    ("Going into the house, they see the child with Mary His mother, and they fall down and worship Him.", "P2"),
                    ("Then opening their treasures, they offer gifts of gold and frankincense and myrrh.", "P1"),
                    ("The light has not merely helped them navigate; it has brought them to adoration.", "P1"),
                    ("In Matthew, true light does not terminate in curiosity, but in worship before Jesus.", "P3"),
                ],
                "observation": "The star rests over the child and leads to worship.",
                "meaning": "Light has fulfilled its purpose when it brings hearts to Jesus.",
                "personal": "You can let the light lead you into quiet worship rather than restless searching.",
            },
            {
                "file": "04-great-light-in-galilee.ssml",
                "narrative": [
                    ("Later in Matthew, after John is arrested, Jesus withdraws into Galilee and lives in Capernaum by the sea, in the territory of Zebulun and Naphtali.", "P1"),
                    ("Matthew says this fulfills what was spoken by the prophet Isaiah: the people dwelling in darkness have seen a great light, and for those dwelling in the region and shadow of death, on them a light has dawned.", "P2"),
                    ("The light is no longer only above in the sky, but present in the ministry of Jesus Himself.", "P1"),
                    ("Where darkness had been named, dawn now arrives; where the shadow of death had been spoken, light now shines.", "P1"),
                    ("Matthew wants the reader to understand that Jesus is not merely accompanied by signs of light; His coming is itself the dawning of light upon darkened land.", "P1"),
                    ("This is light as visitation, light as fulfilment, light as the presence of the promised King.", "P3"),
                ],
                "observation": "In Matthew four, the great light is the coming and ministry of Jesus.",
                "meaning": "Christ is the dawning answer to the land in darkness.",
                "personal": "You do not remain in darkness when Christ has dawned.",
            },
            {
                "file": "05-light-of-the-world.ssml",
                "narrative": [
                    ("In the Sermon on the Mount, Jesus speaks directly to His disciples and says, You are the light of the world.", "P1"),
                    ("A city set on a hill cannot be hidden.", "P1"),
                    ("The words are striking because the light that dawned in Him now extends as vocation to those who follow Him.", "P2"),
                    ("Their light is not self-made glory; it is the visible witness of lives shaped by the King who has called them.", "P1"),
                    ("Matthew places this statement after the Beatitudes, as though the blessed life itself becomes a kind of shining in the world.", "P1"),
                    ("To be called light here is not permission for self-display, but a summons to visible faithfulness under Jesus.", "P3"),
                ],
                "observation": "Jesus calls His disciples the light of the world.",
                "meaning": "The light of Christ is meant to be seen in the lives of His people.",
                "personal": "You can receive your calling from Christ without needing to manufacture it.",
            },
            {
                "file": "06-lamp-on-stand.ssml",
                "narrative": [
                    ("Jesus continues by saying that people do not light a lamp and put it under a basket, but on a stand, and it gives light to all in the house.", "P1"),
                    ("The image is domestic, ordinary, and clear: light is for illumination, not concealment.", "P1"),
                    ("Matthew's picture of light moves from star, to dawn, to the lamp set high enough to serve the room around it.", "P2"),
                    ("The disciple is not told to create the flame, but not to hide what God has given.", "P1"),
                    ("A lamp on a stand is useful, steady, and quiet, doing its work without noise.", "P1"),
                    ("This gentle household image keeps the idea of light from becoming proud, because its purpose remains service.", "P3"),
                ],
                "observation": "A lamp is placed where its light can serve the house.",
                "meaning": "The light Jesus gives is meant for faithful visibility and useful witness.",
                "personal": "You do not need dramatic display to shine faithfully.",
            },
            {
                "file": "07-shining-gently.ssml",
                "narrative": [
                    ("Jesus then says, In the same way, let your light shine before others, so that they may see your good works and give glory to your Father who is in heaven.", "P1"),
                    ("The final aim is not admiration for the disciple, but glory for the Father.", "P1"),
                    ("Matthew's theology of light is therefore both revealed and reflected: Christ dawns, and His people shine in a way that points upward.", "P2"),
                    ("Good works are described not as private inward sentiment only, but as light-bearing action that can be seen.", "P1"),
                    ("The story of light in Matthew moves from heaven's sign to earth's witness, from the star to the house, from the child to the disciple.", "P1"),
                    ("And yet the centre never changes, because all true light in the Gospel is ordered toward the honour of God through Jesus Christ.", "P3"),
                ],
                "observation": "Light in Matthew finally points away from self and toward the glory of the Father.",
                "meaning": "The purpose of shining is witness, not self-exaltation.",
                "personal": "You can live quietly faithful and let that light point beyond you.",
            },
        ],
        "entry": [
            ("Tonight we will follow the theme of light through the Gospel of Matthew.", "P1"),
            ("A star rises.", "P1"),
            ("A child is worshipped.", "P1"),
            ("A great light dawns in Galilee.", "P1"),
            ("Disciples are called the light of the world.", "P2"),
            ("And through every scene, the light points us to Jesus and to the glory of the Father.", "P3"),
        ],
        "integration_1": [
            "The star led to Jesus.",
            "The wise men worshipped the child.",
            "A great light dawned in Galilee.",
            "Jesus called His people the light of the world.",
            "The lamp was set on a stand.",
            "Good works were meant to glorify the Father.",
        ],
        "integration_2": [
            ("Christ is the dawning light.", "P3"),
            ("His people shine because of Him.", "P3"),
            ("The Father receives the glory.", "P3"),
            ("You are called to walk in His light.", "P4"),
            ("You are safe in the light of Christ.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "Christ is the dawning light.",
            "His light leads toward the Father.",
            "You are called to walk in His light.",
            "You are safe in the light of Christ.",
            "The lamp shines quietly.",
            "You can rest.",
        ],
        "identity": "You are called to walk in His light.",
        "safety": "You are safe in the light of Christ.",
    },
    {
        "folder": "012_genesis_abraham",
        "entry_file": "01-entry.ssml",
        "units": [
            {
                "file": "02-leave-your-country.ssml",
                "narrative": [
                    ("In Genesis the story of Abraham begins when the Lord speaks to Abram and tells him to go from his country, his kindred, and his father's house to the land that God will show him.", "P1"),
                    ("The Lord joins the command to a promise: He will make Abram a great nation, bless him, make his name great, and through him bless all the families of the earth.", "P2"),
                    ("So Abram goes, as the Lord has told him, and Lot goes with him, while Sarai and all their possessions travel into the land of Canaan.", "P1"),
                    ("The story begins not with sight, but with hearing, because Abram moves on the strength of God's word before he owns the land that has been named.", "P1"),
                    ("At Shechem the Lord appears and says, To your offspring I will give this land, and Abram builds an altar there to the Lord who had appeared to him.", "P1"),
                    ("From the opening, Abraham's life is marked by promise received, journey undertaken, and worship offered in response.", "P3"),
                ],
                "observation": "Abram goes because the Lord speaks and promises.",
                "meaning": "The life of faith begins with God's word before visible possession.",
                "personal": "You do not need the whole map before trusting the God who speaks.",
            },
            {
                "file": "03-altars-and-stars.ssml",
                "narrative": [
                    ("As Abram moves through the land, he keeps building altars to the Lord, calling upon the name of the Lord at the places where God has spoken to him.", "P1"),
                    ("After Lot separates from him, the Lord tells Abram to lift up his eyes and look in every direction, because all the land he sees will be given to him and to his offspring forever.", "P1"),
                    ("Later, when Abram asks how the promise of offspring can stand while he remains childless, the Lord brings him outside and tells him to look toward heaven and number the stars, if he can.", "P2"),
                    ("So shall your offspring be, God says, and Abram believes the Lord, and He counts it to him as righteousness.", "P1"),
                    ("The stars are not given as decoration, but as a sign large enough to hold a human doubt inside divine promise.", "P1"),
                    ("Genesis lets the night sky become a witness to the future God will create from a man who cannot create it for himself.", "P3"),
                ],
                "observation": "Abram worships at altars and believes beneath the stars.",
                "meaning": "Faith is sustained by God's promise when the visible circumstances remain incomplete.",
                "personal": "You can rest beneath promises larger than your present sight.",
            },
            {
                "file": "04-covenant-and-name.ssml",
                "narrative": [
                    ("In Genesis fifteen the Lord makes covenant with Abram, passing between the pieces while Abram sleeps and the smoking fire pot and flaming torch move through the prepared animals.", "P1"),
                    ("The covenant does not rest on Abram's strength, but on the Lord's binding word.", "P1"),
                    ("Later in Genesis seventeen, God appears again and says, I am God Almighty; walk before Me, and be blameless.", "P2"),
                    ("Abram's name becomes Abraham, because he will be the father of a multitude of nations, and Sarai becomes Sarah.", "P1"),
                    ("The covenant sign is given, and the promise is sharpened around a coming son through Sarah.", "P1"),
                    ("The story keeps returning to the same centre: what Abraham will become depends finally on what God has pledged to do.", "P3"),
                ],
                "observation": "God binds Himself to the promise and renames Abraham and Sarah in covenant.",
                "meaning": "The future rests on God's pledged faithfulness more than on human capacity.",
                "personal": "You are safer in God's promise than in your own calculations.",
            },
            {
                "file": "05-visitors-and-laughter.ssml",
                "narrative": [
                    ("In Genesis eighteen the Lord appears by the oaks of Mamre as Abraham sits at the door of his tent in the heat of the day.", "P1"),
                    ("Abraham looks up, sees three men standing before him, and hastens to welcome them with water, bread, curds, milk, and a calf prepared for the meal.", "P1"),
                    ("The visitors ask where Sarah is, and then comes the promise spoken with precise timing: I will surely return to you about this time next year, and Sarah your wife shall have a son.", "P2"),
                    ("Sarah listens at the tent door and laughs within herself, because both she and Abraham are old and the way of women has ceased with her.", "P1"),
                    ("But the Lord asks, Is anything too hard for the Lord? and repeats the appointed time for the promised birth.", "P1"),
                    ("The laughter in this scene begins in disbelief, yet the Lord does not surrender the promise to the weakness of human expectation.", "P3"),
                ],
                "observation": "The promise of Isaac is spoken into a place where human possibility has run out.",
                "meaning": "What is impossible with age and barrenness is not too hard for the Lord.",
                "personal": "You can let God's promise stand even where your strength does not.", 
            },
            {
                "file": "06-isaac-born.ssml",
                "narrative": [
                    ("Genesis twenty one opens with one of Scripture's most restful fulfilment lines: The Lord visited Sarah as He had said, and the Lord did to Sarah as He had promised.", "P1"),
                    ("Sarah conceives and bears Abraham a son in his old age at the time of which God had spoken to him.", "P1"),
                    ("Abraham calls the name of his son Isaac, and Sarah says that God has made laughter for her, and everyone who hears will laugh over her.", "P2"),
                    ("The promise that once sounded impossible is now held in human arms.", "P1"),
                    ("Genesis is careful to tie the event to what God had said, as He had promised, at the appointed time, because the birth is a fulfilment before it is merely a surprise.", "P1"),
                    ("Isaac's birth teaches that the Lord's word can be slow without becoming uncertain.", "P3"),
                ],
                "observation": "Isaac is born exactly in the line of God's spoken promise.",
                "meaning": "Delayed fulfilment is still fulfilment when the Lord has spoken.",
                "personal": "You do not need to force what God is able to bring in His time.",
            },
            {
                "file": "07-moriah-and-provision.ssml",
                "narrative": [
                    ("In Genesis twenty two God tests Abraham, telling him to take his son, his only son Isaac, whom he loves, and go to the land of Moriah to offer him there on one of the mountains that God will show him.", "P1"),
                    ("Abraham rises early, journeys with Isaac, and when Isaac asks where the lamb is, Abraham answers that God will provide for Himself the lamb for a burnt offering.", "P2"),
                    ("At the place God has shown, Abraham builds the altar and stretches out his hand, but the angel of the Lord calls from heaven and tells him not to lay his hand on the boy.", "P1"),
                    ("Now I know that you fear God, the angel says, seeing you have not withheld your son, your only son, from Me.", "P1"),
                    ("Abraham lifts his eyes and sees a ram caught in a thicket by its horns, and he offers it instead of his son, calling the place The Lord will provide.", "P1"),
                    ("The Abraham story comes to one of its deepest points here: trust, surrender, and the provision of God at the place of need.", "P3"),
                ],
                "observation": "On Moriah, the Lord provides what Abraham cannot produce for himself.",
                "meaning": "The God of Abraham remains faithful at the place of testing.",
                "personal": "You can rest in the provision of the Lord.",
            },
        ],
        "entry": [
            ("Tonight we will follow the story of Abraham in Genesis, from the first call to the promise of Isaac and the provision on Moriah.", "P1"),
            ("It is a story of journey and promise.", "P1"),
            ("It is a story of waiting and fulfilment.", "P1"),
            ("Again and again God speaks, and Abraham must trust what he cannot yet see.", "P2"),
            ("The promise is tested, delayed, repeated, and kept.", "P1"),
            ("And beneath it all stands the faithfulness of God.", "P3"),
        ],
        "integration_1": [
            "The Lord called Abraham.",
            "The Lord showed him the land.",
            "The Lord counted his faith as righteousness.",
            "The Lord gave Isaac as promised.",
            "The Lord provided on Moriah.",
            "The Lord kept His word.",
        ],
        "integration_2": [
            ("God speaks and guides.", "P3"),
            ("God promises and keeps.", "P3"),
            ("God provides at the needed place.", "P3"),
            ("You are held by His faithfulness.", "P4"),
            ("You are safe in the promise of God.", "P4"),
            ("You can rest.", "P5"),
        ],
        "phrases": [
            "The Lord keeps His word.",
            "The Lord provides.",
            "His promise does not fail.",
            "You are held by His faithfulness.",
            "You are safe in the promise of God.",
            "You can rest.",
        ],
        "identity": "You are held by His faithfulness.",
        "safety": "You are safe in the promise of God.",
    },
]


def write_topic(topic: dict) -> tuple[list[tuple[str, int, float]], float]:
    folder = OUT / topic["folder"]
    folder.mkdir(parents=True, exist_ok=True)
    written: list[tuple[str, int, float]] = []

    files: list[tuple[str, str]] = [(topic["entry_file"], build_entry(topic))]
    for index, unit in enumerate(topic["units"]):
        files.append((unit["file"], build_unit(unit, index)))
    files.append(("08-integration-1.ssml", build_integration(topic)))
    files.append(("09-integration-2.ssml", build_integration_2(topic)))

    total_before_loops = 0.0
    for name, content in files:
        key = name[:2]
        rate, pitch = RATES[key]
        ssml = wrap(content, rate, pitch)
        path = folder / name
        path.write_text(ssml, encoding="utf-8")
        minutes = estimate_minutes(ssml)
        written.append((name, len(ssml), minutes))
        total_before_loops += minutes

    phrases = topic["phrases"]
    target_total = 24.8
    wave_1_cycles = 3
    wave_2_cycles = 3
    wave_1 = wrap(build_wave_1(phrases, wave_1_cycles), *RATES["10"])
    wave_1_minutes = estimate_minutes(wave_1)
    cycle_probe = estimate_minutes(wrap(build_wave_3(phrases, 1), *RATES["12"]))

    while True:
        wave_2 = wrap(build_wave_2(phrases, wave_2_cycles), *RATES["11"])
        wave_2_minutes = estimate_minutes(wave_2)
        remaining = target_total - (total_before_loops + wave_1_minutes + wave_2_minutes)
        wave_3_cycles = max(2, math.ceil(remaining / cycle_probe))
        wave_3 = wrap(build_wave_3(phrases, wave_3_cycles), *RATES["12"])
        if len(wave_3) < 3000 or wave_2_cycles >= 5:
            break
        wave_2_cycles += 1

    for name, ssml in [
        ("10-sleep-loop-wave1.ssml", wave_1),
        ("11-sleep-loop-wave2.ssml", wave_2),
        ("12-sleep-loop-wave3.ssml", wave_3),
    ]:
        path = folder / name
        path.write_text(ssml, encoding="utf-8")
        written.append((name, len(ssml), estimate_minutes(ssml)))

    total = sum(minutes for _, _, minutes in written)
    return written, total


def main() -> None:
    results = {}
    for topic in TOPICS:
        written, total = write_topic(topic)
        results[topic["folder"]] = {"files": written, "total": total}

    for folder, data in results.items():
        print(f"== {folder} ==")
        for name, chars, minutes in data["files"]:
            print(f"{name}\tchars={chars}\test_min={minutes:.2f}")
        print(f"TOTAL\t{data['total']:.2f}")
        print()

    errors = []
    for folder, data in results.items():
        for name, chars, _ in data["files"]:
            if chars >= 3000:
                errors.append(f"{folder}/{name} is {chars} chars")
        if data["total"] < 24.0:
            errors.append(f"{folder} total runtime too short: {data['total']:.2f} min")
    if errors:
        raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()
