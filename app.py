from flask import Flask, request, jsonify, send_from_directory
import joblib
import pickle
import numpy as np
import os

app = Flask(__name__, static_folder=".")

rfmodel = joblib.load("rfmodel.pkl")

FEATURE_ORDER =[
    "Exposure", "Ocean_Name", "SSTA_DHW", "SSTA_DHWMax", "SSTA_DHWMean",
    "TSA_DHW", "TSA_DHWMax", "TSA_DHWMean", "SSTA", "SSTA_Frequency",
    "SSTA_FrequencyMax", "TSA_Frequency", "TSA_FrequencyMax", "TSA_Maximum",
    "ClimSST", "Temperature_Mean", "Turbidity", "Depth_m",
    "Cyclone_Frequency", "Distance_to_Shore"
]

FEATURE_IMPORTANCES = None
if hasattr(rfmodel, "feature_importances_"):
    raw = rfmodel.feature_importances_
    FEATURE_IMPORTANCES = {
        feat: round(float(imp),6)
        for feat, imp in zip(FEATURE_ORDER, raw)
    }
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".",filename)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data"}), 400
        
        #feature vector
        features = []
        missing =[]
        for f in FEATURE_ORDER:
            if f not in data:
                missing.append(f)
            else:
                features.append(float(data[f]))
        if missing:
            return jsonify({"error": f"Missing features: {missing}"}), 400
        X = np.array(features).reshape(1,-1)
        prediction = float(rfmodel.predict(X)[0])
        #make sure prediction is in range[0,100] js in case
        bleaching_percent = round(max(0.0, min(100.0, prediction)), 2)
        response = {
            "bleaching_percent" : bleaching_percent,
            "features_used": FEATURE_ORDER,
        }
        if FEATURE_IMPORTANCES:
            response["feature_importances"] = FEATURE_IMPORTANCES
        return jsonify(response)
    except Exception as e:
        return jsonify({"error":str(e)}), 500
    
# health check

@app.route("/health", methods = ["GET"])
def health():
    return jsonify({"status":"ok", "model_loaded": rfmodel is not None})

if __name__ == "__main__":
    app.run(debug=True, port=4080)