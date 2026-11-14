class_name GameAudio
extends Node
## Nhạc nền (6 bài CC0, phát xáo trộn, chuyển bài mượt) + tiếng hiệu ứng tổng hợp sẵn (giống beep() của bản web).

const TRACKS := [
	{"file": "apple-cider", "title": "Apple Cider", "by": "Zane Little Music"},
	{"file": "happy-lofi-day", "title": "Happy Lofi Day", "by": "Tarush Singhal"},
	{"file": "shop-theme", "title": "Buy Something!", "by": "Cleyton Kauffman"},
	{"file": "chill-lofi-inspired", "title": "Chill Lofi Inspired", "by": "omfgdude"},
	{"file": "town-theme-rpg", "title": "Town Theme", "by": "cynicmusic"},
	{"file": "flowerbed-fields-loop", "title": "Flowerbed Fields", "by": "Zane Little Music"},
]
const MUSIC_DB := -15.0         # nhạc nền nhỏ, để nghe rõ hiệu ứng
const XFADE := 3.0

signal track_changed(t: Dictionary)

var music_on := true
var sound_on := true
var decks: Array[AudioStreamPlayer] = []
var cur := 0
var order: Array = []
var pos := -1
var sfx_cache := {}
var sfx_players: Array[AudioStreamPlayer] = []


func _ready() -> void:
	for k in 2:
		var p := AudioStreamPlayer.new()
		p.volume_db = -80
		add_child(p)
		decks.append(p)
	for k in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		sfx_players.append(p)


func _shuffle() -> void:
	var last = order[-1] if order.size() else -1
	order = range(TRACKS.size())
	order.shuffle()
	if order.size() > 1 and order[0] == last:
		var tmp = order[0]
		order[0] = order[1]
		order[1] = tmp
	pos = -1


func next_track() -> void:
	if pos + 1 >= order.size():
		_shuffle()
	pos += 1
	var t: Dictionary = TRACKS[order[pos]]
	var old := decks[cur]
	cur = 1 - cur
	var d := decks[cur]
	var st: AudioStreamMP3 = load("res://assets/music/%s.mp3" % t.file)
	d.stream = st
	d.volume_db = -40
	d.play()
	var tw := create_tween().set_parallel(true)
	tw.tween_property(d, "volume_db", MUSIC_DB, XFADE)
	if old.playing:
		tw.tween_property(old, "volume_db", -60.0, XFADE)
		tw.chain().tween_callback(old.stop)
	track_changed.emit(t)


func set_music(on: bool) -> void:
	music_on = on
	if on:
		if not decks[cur].playing:
			if decks[cur].stream:
				decks[cur].play(decks[cur].get_meta("at", 0.0))
				create_tween().tween_property(decks[cur], "volume_db", MUSIC_DB, 0.8)
			else:
				next_track()
	else:
		for d in decks:
			if d.playing:
				d.set_meta("at", d.get_playback_position())
				var tw := create_tween()
				tw.tween_property(d, "volume_db", -60.0, 0.5)
				tw.tween_callback(d.stop)


func _process(_dt: float) -> void:
	var d := decks[cur]
	if music_on and d.playing and d.stream and d.stream.get_length() - d.get_playback_position() < XFADE:
		next_track()


# ======================= hiệu ứng tổng hợp =======================
func _tone(freq: float, dur: float, type: String, vol: float) -> AudioStreamWAV:
	var key := "%s|%s|%s|%s" % [freq, dur, type, vol]
	if sfx_cache.has(key):
		return sfx_cache[key]
	var rate := 44100
	var n := int(rate * dur)
	var data := PackedByteArray()
	data.resize(n * 2)
	var ph := 0.0
	for i in n:
		var tt := float(i) / rate
		ph = fmod(ph + freq / rate, 1.0)
		var w := 0.0
		match type:
			"square":
				w = 1.0 if ph < 0.5 else -1.0
			"triangle":
				w = 4.0 * absf(ph - 0.5) - 1.0
			"sawtooth":
				w = 2.0 * ph - 1.0
			_:
				w = sin(ph * TAU)
		var env := vol * pow(0.0001 / vol, tt / dur)   # tắt dần theo hàm mũ như exponentialRampToValueAtTime
		data.encode_s16(i * 2, int(clampf(w * env * 2.2, -1, 1) * 32767))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = rate
	s.data = data
	sfx_cache[key] = s
	return s


func beep(freq: float, dur := 0.06, type := "square", vol := 0.04) -> void:
	if not sound_on:
		return
	var st := _tone(freq, dur, type, vol)
	for p in sfx_players:
		if not p.playing:
			p.stream = st
			p.play()
			return
	sfx_players[0].stream = st
	sfx_players[0].play()


func _seq(freqs: Array, gap: float, dur: float, type: String, vol: float) -> void:
	for k in freqs.size():
		get_tree().create_timer(k * gap).timeout.connect(beep.bind(freqs[k], dur, type, vol))


func sfx(name: String) -> void:
	match name:
		"step":
			beep(540, 0.04, "triangle", 0.05)
		"dice":
			beep(160 + randf() * 240, 0.03, "square", 0.025)
		"coin":
			_seq([988, 1319], 0.07, 0.1, "square", 0.025)
		"pay":
			beep(196, 0.14, "sawtooth", 0.03)
		"card":
			_seq([660, 880], 0.09, 0.12, "sine", 0.06)
		"build":
			beep(392, 0.1, "triangle", 0.06)
		"upgrade":
			_seq([523, 659, 784, 1047, 1319], 0.09, 0.16, "triangle", 0.06)
		"turn":
			beep(740, 0.08, "sine", 0.05)
		"win":
			_seq([523, 659, 784, 1047], 0.13, 0.22, "triangle", 0.07)
		"click":
			beep(880, 0.03, "sine", 0.04)
