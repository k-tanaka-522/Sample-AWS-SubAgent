# C# (.NET Core) コーディング規約

## 基本方針

- **Clean Architecture**
- **Dependency Injection 必須**
- **async/await 推奨**
- **RESTful API 設計**
- **Entity Framework Core 使用**
- **Serilog によるログ管理**

---

## プロジェクト構成（Clean Architecture）

```
MyApp/
├── MyApp.API/                    # Web API (Controllers, Middleware)
│   ├── Controllers/              # API エンドポイント
│   ├── Middleware/               # カスタムミドルウェア
│   ├── Filters/                  # アクションフィルタ
│   ├── Program.cs                # エントリポイント
│   └── appsettings.json          # 設定ファイル
├── MyApp.Application/            # Use cases (ビジネスロジック)
│   ├── Services/                 # アプリケーションサービス
│   ├── DTOs/                     # データ転送オブジェクト
│   ├── Interfaces/               # インターフェース定義
│   └── Validators/               # バリデーションロジック
├── MyApp.Domain/                 # Domain models (エンティティ)
│   ├── Entities/                 # ドメインエンティティ
│   ├── ValueObjects/             # 値オブジェクト
│   └── Exceptions/               # ドメイン例外
└── MyApp.Infrastructure/         # DB, External APIs
    ├── Data/                     # DbContext, Repositories
    ├── Migrations/               # EF Core マイグレーション
    └── ExternalServices/         # 外部 API クライアント
```

---

## Web API 設計

### Controller の基本

```csharp
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        IUserService userService,
        ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// ユーザー一覧を取得
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<UserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
    {
        var users = await _userService.GetAllUsersAsync();
        return Ok(users);
    }

    /// <summary>
    /// ユーザーを ID で取得
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDto>> GetUser(int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            _logger.LogWarning("User {UserId} not found", id);
            return NotFound();
        }
        return Ok(user);
    }

    /// <summary>
    /// ユーザーを作成
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto dto)
    {
        var user = await _userService.CreateUserAsync(dto);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, user);
    }

    /// <summary>
    /// ユーザーを更新
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserDto dto)
    {
        await _userService.UpdateUserAsync(id, dto);
        return NoContent();
    }

    /// <summary>
    /// ユーザーを削除
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteUser(int id)
    {
        await _userService.DeleteUserAsync(id);
        return NoContent();
    }
}
```

### DTO（Data Transfer Object）パターン

```csharp
// ✅ Good: レスポンス用 DTO
public record UserDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}

// ✅ Good: 作成用 DTO
public record CreateUserDto
{
    [Required]
    [StringLength(100)]
    public string Name { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string Password { get; init; } = string.Empty;
}

// ✅ Good: 更新用 DTO
public record UpdateUserDto
{
    [StringLength(100)]
    public string? Name { get; init; }

    [EmailAddress]
    public string? Email { get; init; }
}
```

### バリデーション（FluentValidation 推奨）

```csharp
// ✅ Good: FluentValidation
public class CreateUserDtoValidator : AbstractValidator<CreateUserDto>
{
    public CreateUserDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("名前は必須です")
            .MaximumLength(100).WithMessage("名前は100文字以内で入力してください");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("メールアドレスは必須です")
            .EmailAddress().WithMessage("有効なメールアドレスを入力してください");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("パスワードは必須です")
            .MinimumLength(8).WithMessage("パスワードは8文字以上で入力してください")
            .Matches(@"[A-Z]").WithMessage("パスワードには大文字を含めてください")
            .Matches(@"[a-z]").WithMessage("パスワードには小文字を含めてください")
            .Matches(@"[0-9]").WithMessage("パスワードには数字を含めてください");
    }
}

// Program.cs で登録
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserDtoValidator>();
builder.Services.AddFluentValidationAutoValidation();
```

### グローバルエラーハンドリング

```csharp
// ✅ Good: グローバル例外ハンドラー
public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "An unhandled exception occurred");

        var (statusCode, message) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            _ => (StatusCodes.Status500InternalServerError, "An error occurred")
        };

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(new
        {
            error = message,
            statusCode
        }, cancellationToken);

        return true;
    }
}

// Program.cs で登録
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
```

---

## Entity Framework Core

### DbContext の設計

```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ✅ Good: Fluent API で設定
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.HasIndex(e => e.Email).IsUnique();

            // 論理削除
            entity.HasQueryFilter(e => !e.IsDeleted);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(e => e.User)
                  .WithMany(u => u.Orders)
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });
    }

    // ✅ Good: SaveChanges をオーバーライドして監査情報を自動設定
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is BaseEntity &&
                       (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in entries)
        {
            var entity = (BaseEntity)entry.Entity;

            if (entry.State == EntityState.Added)
            {
                entity.CreatedAt = DateTime.UtcNow;
            }
            entity.UpdatedAt = DateTime.UtcNow;
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
```

### Repository パターン

```csharp
// ✅ Good: Generic Repository
public interface IRepository<T> where T : BaseEntity
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(int id);
}

public class Repository<T> : IRepository<T> where T : BaseEntity
{
    protected readonly ApplicationDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(ApplicationDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(int id)
    {
        return await _dbSet.FindAsync(id);
    }

    public virtual async Task<IEnumerable<T>> GetAllAsync()
    {
        return await _dbSet.ToListAsync();
    }

    public virtual async Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public virtual async Task UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();
    }

    public virtual async Task DeleteAsync(int id)
    {
        var entity = await GetByIdAsync(id);
        if (entity != null)
        {
            _dbSet.Remove(entity);
            await _context.SaveChangesAsync();
        }
    }
}

// ✅ Good: 特化した Repository
public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email);
    Task<IEnumerable<User>> GetActiveUsersAsync();
}

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<IEnumerable<User>> GetActiveUsersAsync()
    {
        return await _dbSet.Where(u => u.IsActive).ToListAsync();
    }
}
```

### マイグレーション管理

```bash
# マイグレーション作成
dotnet ef migrations add InitialCreate --project MyApp.Infrastructure --startup-project MyApp.API

# マイグレーション適用
dotnet ef database update --project MyApp.Infrastructure --startup-project MyApp.API

# マイグレーション削除（未適用の場合のみ）
dotnet ef migrations remove --project MyApp.Infrastructure --startup-project MyApp.API
```

### N+1 問題対策

```csharp
// ❌ Bad: N+1 問題
public async Task<IEnumerable<OrderDto>> GetOrdersAsync()
{
    var orders = await _context.Orders.ToListAsync();
    // 各 Order に対して User を取得（N+1 クエリ）
    return orders.Select(o => new OrderDto
    {
        Id = o.Id,
        UserName = o.User.Name // ここで追加クエリが発生
    });
}

// ✅ Good: Include で関連データを一度に取得
public async Task<IEnumerable<OrderDto>> GetOrdersAsync()
{
    var orders = await _context.Orders
        .Include(o => o.User)        // Eager Loading
        .ToListAsync();

    return orders.Select(o => new OrderDto
    {
        Id = o.Id,
        UserName = o.User.Name
    });
}

// ✅ Good: Select で必要なデータだけ取得（より効率的）
public async Task<IEnumerable<OrderDto>> GetOrdersAsync()
{
    return await _context.Orders
        .Select(o => new OrderDto
        {
            Id = o.Id,
            UserName = o.User.Name  // JOIN されて1クエリで取得
        })
        .ToListAsync();
}
```

---

## 認証・認可

### JWT 認証

```csharp
// appsettings.json
{
  "Jwt": {
    "Key": "your-secret-key-min-32-characters",
    "Issuer": "your-app",
    "Audience": "your-app-users",
    "ExpiryMinutes": 60
  }
}

// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

app.UseAuthentication();
app.UseAuthorization();

// ✅ Good: JWT トークン生成サービス
public class JwtTokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(
                int.Parse(_configuration["Jwt:ExpiryMinutes"]!)),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
```

### 認可（ロールベース）

```csharp
// ✅ Good: ロールベース認可
[Authorize(Roles = "Admin")]
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteUser(int id)
{
    await _userService.DeleteUserAsync(id);
    return NoContent();
}

// ✅ Good: ポリシーベース認可
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole("Admin"));
    options.AddPolicy("CanEditUser", policy =>
        policy.RequireClaim("Permission", "EditUser"));
});

[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    // Admin ロールのみアクセス可能
}
```

---

## ロギング（Serilog）

### Serilog 設定

```csharp
// Program.cs
using Serilog;

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithEnvironmentName()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// appsettings.json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "System": "Warning"
      }
    }
  }
}

// ✅ Good: 構造化ログ
_logger.LogInformation("User {UserId} created order {OrderId}", userId, orderId);

// ❌ Bad: 文字列連結
_logger.LogInformation($"User {userId} created order {orderId}");
```

---

## API ドキュメント（Swagger/OpenAPI）

```csharp
// Program.cs
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API documentation for My App"
    });

    // XML コメントを有効化
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath);

    // JWT 認証を Swagger に追加
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
```

---

## CORS 設定

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("https://localhost:3000", "https://example.com")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

app.UseCors("AllowFrontend");
```

---

## 環境変数管理

```csharp
// appsettings.json（開発環境）
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=MyApp;User Id=sa;Password=YourPassword;"
  },
  "Jwt": {
    "Key": "development-key-min-32-characters"
  }
}

// appsettings.Production.json（本番環境）
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod-server;Database=MyApp;User Id=sa;Password=***;"
  }
}

// ✅ Good: 環境変数で上書き（本番環境）
// 環境変数名: ConnectionStrings__DefaultConnection
// 環境変数名: Jwt__Key

// Program.cs
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
```

---

## パフォーマンス最適化

### 非同期ストリーム（大量データ）

```csharp
// ✅ Good: IAsyncEnumerable で大量データを効率的に処理
[HttpGet("stream")]
public async IAsyncEnumerable<UserDto> GetUsersStream()
{
    await foreach (var user in _userService.GetUsersStreamAsync())
    {
        yield return user;
    }
}

public async IAsyncEnumerable<User> GetUsersStreamAsync()
{
    await foreach (var user in _context.Users.AsAsyncEnumerable())
    {
        yield return user;
    }
}
```

### レスポンスキャッシュ

```csharp
// Program.cs
builder.Services.AddResponseCaching();
app.UseResponseCaching();

// ✅ Good: キャッシュ設定
[HttpGet]
[ResponseCache(Duration = 60)] // 60秒キャッシュ
public async Task<ActionResult<IEnumerable<UserDto>>> GetUsers()
{
    var users = await _userService.GetAllUsersAsync();
    return Ok(users);
}
```

---

## コーディング規約（基本）

### 命名規則

```csharp
// ✅ Good: PascalCase（クラス、メソッド、プロパティ）
public class UserService
{
    public async Task<User> GetUserAsync(int userId) { }
    public string FullName { get; set; }
}

// ✅ Good: private field は _camelCase
private readonly IUserRepository _userRepository;

// ✅ Good: パラメータ・ローカル変数は camelCase
public void ProcessUser(int userId, string userName)
{
    var isValid = ValidateUser(userId);
}

// ✅ Good: 定数は PascalCase
public const int MaxRetryCount = 3;

// ✅ Good: インターフェースは I で始まる
public interface IUserService { }
```

### Dependency Injection

```csharp
// ✅ Good
public class UserService
{
    private readonly IUserRepository _userRepository;

    public UserService(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }
}

// Startup.cs
services.AddScoped<IUserRepository, UserRepository>();
services.AddScoped<IUserService, UserService>();
```

### 非同期処理

```csharp
// ✅ Good
public async Task<User> GetUserAsync(int userId)
{
    return await _userRepository.FindByIdAsync(userId);
}

// ❌ Bad: 同期メソッド（I/O処理なのに）
public User GetUser(int userId)
{
    return _userRepository.FindById(userId);
}
```

### エラーハンドリング

```csharp
// ✅ Good
public class UserNotFoundException : Exception
{
    public UserNotFoundException(int userId)
        : base($"User with ID {userId} not found") { }
}

public async Task<User> GetUserAsync(int userId)
{
    var user = await _userRepository.FindByIdAsync(userId);
    if (user == null)
    {
        throw new UserNotFoundException(userId);
    }
    return user;
}
```

---

## テスト

- **フレームワーク**: xUnit
- **モック**: Moq
- **カバレッジ**: coverlet

```csharp
public class UserServiceTests
{
    [Fact]
    public async Task GetUser_WhenUserExists_ReturnsUser()
    {
        // Arrange
        var mockRepo = new Mock<IUserRepository>();
        mockRepo.Setup(r => r.FindByIdAsync(1))
                .ReturnsAsync(new User { Id = 1 });

        // Act
        var service = new UserService(mockRepo.Object);
        var user = await service.GetUserAsync(1);

        // Assert
        Assert.Equal(1, user.Id);
    }
}
```

---

**参照**: `.claude/docs/10_facilitation/2.4_実装フェーズ/2.4.5_言語別コーディング規約適用/2.4.5.3_C#規約適用/`
