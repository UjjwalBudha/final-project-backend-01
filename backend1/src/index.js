const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

// Define secret names
const rdsSecretName = "rds!db-230ed15c-206f-489b-a679-90d37f000103";
const projectSecretName =
  "secret-manager-dev-ujwal-final-project20240730034716940500000003";

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "us-east-1",
});

async function getSecret(secretName) {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT",
      })
    );
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error("Error fetching secret from AWS Secrets Manager:", error);
    throw error;
  }
}

(async () => {
  try {
    const rdsSecret = await getSecret(rdsSecretName);
    const projectSecret = await getSecret(projectSecretName);

    // Create a connection to the database using the fetched secrets
    const db = mysql.createConnection({
      host: projectSecret.host,
      user: rdsSecret.username,
      password: rdsSecret.password,
      database: projectSecret.dbname1,
    });

    db.connect((err) => {
      if (err) {
        console.error("Error connecting to the database:", err.stack);
        return;
      }
      console.log("Connected to the database as ID " + db.threadId);
    });

    db.on("error", (err) => {
      console.error("Database error occurred:", err);
    });

    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, "uploads");
      },
      filename: (req, file, cb) => {
        cb(null, `${req.body.productId}${path.extname(file.originalname)}`);
      },
    });

    const upload = multer({ storage: storage });

    const app = express();

    const corsOptions = {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };

    app.use(cors(corsOptions));
    app.use(express.json());
    app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

    app.post(
      "/thumbnailUpload",
      upload.single("productThumbnail"),
      (req, res) => {
        try {
          return res.json({ data: req.file.filename });
        } catch (err) {
          res.json({ error: err.message });
        }
      }
    );

    app.get("/products", (req, res) => {
      const q = "SELECT * FROM product";
      db.query(q, (err, data) => {
        if (err) return res.json({ error: err.sqlMessage });
        else return res.json({ data });
      });
    });

    app.post("/products", (req, res) => {
      const q = `INSERT INTO product (productTitle, productDescription, productPrice, availableQuantity, productThumbnail)
                 VALUES (?, ?, ?, ?, ?)`;
      const {
        productTitle,
        productDescription,
        productPrice,
        availableQuantity,
        productThumbnail,
      } = req.body;
      db.query(
        q,
        [
          productTitle,
          productDescription,
          productPrice,
          availableQuantity,
          productThumbnail,
        ],
        (err, data) => {
          if (err) return res.json({ error: err.sqlMessage });
          else return res.json({ data });
        }
      );
    });

    app.get("/products/:productId", (req, res) => {
      const id = req.params.productId;
      const q = "SELECT * FROM product WHERE productId = ?";
      db.query(q, [id], (err, data) => {
        if (err) return res.json({ error: err.sqlMessage });
        else return res.json({ data });
      });
    });

    app.put("/products/:productId", (req, res) => {
      const id = req.params.productId;
      const data = req.body;
      const q = `UPDATE product SET 
                  productTitle = ?, 
                  productDescription = ?, 
                  productPrice = ?, 
                  availableQuantity = ?, 
                  productThumbnail = ? 
                WHERE productId = ?`;
      db.query(
        q,
        [
          data.productTitle,
          data.productDescription,
          data.productPrice,
          data.availableQuantity,
          data.productThumbnail,
          id,
        ],
        (err, data) => {
          if (err) return res.json({ error: err.sqlMessage });
          else return res.json({ data });
        }
      );
    });

    app.delete("/products/:productId", (req, res) => {
      const id = req.params.productId;
      const q = "DELETE FROM product WHERE productId = ?";
      db.query(q, [id], (err, data) => {
        if (err) return res.json({ error: err.sqlMessage });
        else res.json({ data });
      });
    });

    app.listen(8082, () => {
      console.log(`Listening on port 8082`);
    });
  } catch (error) {
    console.error("Error initializing application:", error);
  }
})();
