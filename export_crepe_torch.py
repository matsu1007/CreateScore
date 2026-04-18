import sys
import os
import torch
import torchcrepe
from torchcrepe.model import Crepe
import torch.onnx
import onnx
import onnxruntime as ort_cpu
import numpy as np

# コマンドライン引数でモデル種別を指定 (デフォルト: tiny)
CAPACITY = sys.argv[1] if len(sys.argv) > 1 else "tiny"
assert CAPACITY in ("tiny", "small", "medium", "large", "full"), f"Unknown capacity: {CAPACITY}"

TMP = f"crepe_{CAPACITY}_tmp.onnx"
OUT = f"crepe_{CAPACITY}.onnx"

print(f"Exporting CREPE '{CAPACITY}' model → {OUT}")

# torchcrepe パッケージ同梱のウェイトを直接ロード
model = Crepe(CAPACITY)
weight_path = os.path.join(os.path.dirname(torchcrepe.__file__), 'assets', f'{CAPACITY}.pth')
model.load_state_dict(torch.load(weight_path, map_location='cpu', weights_only=True))
model.eval()

dummy_input = torch.zeros(1, 1024)

# opset 13 + レガシーエクスポーター（onnxruntime-web との互換性が高い）
torch.onnx.export(
    model,
    dummy_input,
    TMP,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}},
    opset_version=13,
    do_constant_folding=True,
)

# 外部データファイル（.data）を読み込んで単一ファイルに統合して保存
# onnxruntime-web は外部データを URL 経由でロードできないため必須
onnx_model = onnx.load(TMP, load_external_data=True)
onnx.save_model(onnx_model, OUT, save_as_external_data=False)
print(f"exported (single file): {OUT}  ({os.path.getsize(OUT):,} bytes)")

# 一時ファイル削除
for f in [TMP, TMP + ".data"]:
    if os.path.exists(f):
        os.remove(f)
        print(f"removed: {f}")

# ONNX 形式チェック
onnx_model = onnx.load(OUT)
onnx.checker.check_model(onnx_model)
print("onnx.checker: OK")
print("opset:", onnx_model.opset_import[0].version)

# CPU 推論で出力 shape を確認
sess = ort_cpu.InferenceSession(OUT, providers=['CPUExecutionProvider'])
out = sess.run(None, {'input': np.zeros((1, 1024), dtype=np.float32)})
print("output shape:", out[0].shape)  # (1, 360) が期待値

print(f"\n配置コマンド:\n  copy {OUT} public\\model\\{OUT}")
