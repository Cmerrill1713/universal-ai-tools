import Foundation
import CoreBluetooth
import CoreLocation

extension ProximityDetectionService: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            self.bluetoothState = central.state

            switch central.state {
            case .poweredOn:
                print("✅ Bluetooth is powered on")
                if self.isScanning {
                    self.startBLEScanningPublic()
                }
            case .poweredOff:
                print("❌ Bluetooth is powered off")
                self.delegate?.proximityDetectionDidFail(error: .bluetoothUnavailable)
            case .unauthorized:
                print("❌ Bluetooth access unauthorized")
                self.delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized)
            case .unsupported:
                print("❌ Bluetooth unsupported on this device")
                self.delegate?.proximityDetectionDidFail(error: .bluetoothUnsupported)
            default:
                print("🔄 Bluetooth state: \(central.state.rawValue)")
            }
        }
    }
}

extension ProximityDetectionService: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                print("✅ Location authorization granted")
                if self.isScanning {
                    self.startBeaconMonitoringPublic()
                }
            case .denied, .restricted:
                print("❌ Location authorization denied")
                self.delegate?.proximityDetectionDidFail(error: .locationUnauthorized)
            default:
                break
            }
        }
    }
}

extension ProximityDetectionService {
    // Public wrappers to call from nonisolated delegate methods
    nonisolated func startBLEScanningPublic() {
        Task { @MainActor in
            self.startBLEScanning()
        }
    }

    nonisolated func startBeaconMonitoringPublic() {
        Task { @MainActor in
            self.startBeaconMonitoring()
        }
    }

    // Keep these internal for wrapper access
    func checkBluetoothPermissions() -> Bool {
        switch CBCentralManager.authorization {
            case .allowedAlways:
                return true
            case .denied, .restricted:
                delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized)
                return false
            case .notDetermined:
                // Will prompt for permission
                return true
            @unknown default:
                return false
        }
    }

    func setupBeaconRegion() {
        locationManager = CLLocationManager()
        locationManager?.delegate = self
        locationManager?.requestWhenInUseAuthorization()

        beaconRegion = CLBeaconRegion(
            uuid: beaconUUID,
            identifier: beaconIdentifier
        )
        beaconRegion?.notifyOnEntry = true
        beaconRegion?.notifyOnExit = true
        beaconRegion?.notifyEntryStateOnDisplay = true
    }

    func startBeaconMonitoring() {
        guard let locationManager = locationManager,
              let beaconRegion = beaconRegion else {
            return
        }

        if CLLocationManager.isMonitoringAvailable(for: CLBeaconRegion.self) {
            locationManager.startMonitoring(for: beaconRegion)
            locationManager.requestState(for: beaconRegion)
            print("📡 Started beacon monitoring")
        }
    }

    func stopBeaconMonitoring() {
        guard let locationManager = locationManager,
              let beaconRegion = beaconRegion else {
            return
        }

        locationManager.stopMonitoring(for: beaconRegion)
        locationManager.stopRangingBeacons(satisfying: beaconRegion.beaconIdentityConstraint)
    }
}
