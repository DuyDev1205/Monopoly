class_name Updater
extends Node
## Tự kiểm tra bản mới trên GitHub Releases (latest.json — cùng tệp bản Tauri cũ dùng).
## Windows: tải bộ cài rồi chạy cài lặng lẽ (/P), cài xong tự mở lại game. macOS: mở trang tải bản mới.

const LATEST := "https://github.com/DuyDev1205/Monopoly/releases/latest/download/latest.json"
const RELEASES := "https://github.com/DuyDev1205/Monopoly/releases/latest"

signal found(version: String, notes: String)
signal progress(p: float)
signal failed(msg: String)

var info := {}
var http: HTTPRequest
var dl: HTTPRequest


static func newer(a: String, b: String) -> bool:
	var x := a.trim_prefix("v").split(".")
	var y := b.trim_prefix("v").split(".")
	for k in 3:
		var p := int(x[k]) if k < x.size() else 0
		var q := int(y[k]) if k < y.size() else 0
		if p != q:
			return p > q
	return false


func check(current: String) -> void:
	http = HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(func(res, code, _h, body):
		if res != HTTPRequest.RESULT_SUCCESS or code != 200:
			return
		var d = JSON.parse_string(body.get_string_from_utf8())
		if d is Dictionary and newer(str(d.get("version", "0")), current):
			info = d
			found.emit(str(d.version), str(d.get("notes", ""))))
	http.request(LATEST)


func install() -> void:
	var plats: Dictionary = info.get("platforms", {})
	if OS.get_name() != "Windows" or not plats.has("windows-x86_64"):
		OS.shell_open(RELEASES)
		return
	var url: String = plats["windows-x86_64"].url
	var path := OS.get_user_data_dir().path_join("CoTyPhu-update-setup.exe")
	dl = HTTPRequest.new()
	dl.download_file = path
	dl.use_threads = true
	add_child(dl)
	dl.request_completed.connect(func(res, code, _h, _b):
		if res != HTTPRequest.RESULT_SUCCESS or code != 200:
			failed.emit("Tải bản cập nhật không được (mã %d)" % code)
			return
		OS.create_process(path, ["/P"])
		get_tree().quit())
	dl.request(url)
	_poll()


func _poll() -> void:
	while is_instance_valid(dl) and dl.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED or (is_instance_valid(dl) and dl.get_downloaded_bytes() == 0):
		await get_tree().create_timer(0.5).timeout
		if not is_instance_valid(dl):
			return
		var total := dl.get_body_size()
		if total > 0:
			progress.emit(float(dl.get_downloaded_bytes()) / total)
