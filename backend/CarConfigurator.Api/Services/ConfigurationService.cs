using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Models;
using CarConfigurator.Api.Repositories;

namespace CarConfigurator.Api.Services;

public class ConfigurationService : IConfigurationService
{
    public const int MaxConfigurationNameLength = 100;

    private static readonly HashSet<OptionCategory> SingleChoiceCategories = new()
    {
        OptionCategory.ExteriorColor,
        OptionCategory.Rim,
        OptionCategory.Interior
    };

    public static class OptionIds
    {
        public const int BaseEngine = 1;
        public const int SportEngine = 2;

        public const int BaseWhiteColor = 10;
        public const int MetallicColor = 11;
        public const int FireRedColor = 12;

        public const int BaseRim17 = 20;
        public const int Rim18 = 21;
        public const int SportRim19 = 22;

        public const int SportDiffuser = 30;
        public const int TowHook = 31;

        public const int FabricInterior = 40;
        public const int LeatherInterior = 41;

        public const int LargeNavigation = 50;
        public const int PremiumSoundSystem = 51;
        public const int SportSuspension = 52;

        public const int HeatedSeats = 60;
        public const int HeatedSteeringWheel = 61;
        public const int HeatedWindshield = 62;
    }

    public static class ErrorCodes
    {
        public const string NullRequest = "NULL_REQUEST";
        public const string MissingEngine = "MISSING_ENGINE";
        public const string InvalidEngineId = "INVALID_ENGINE_ID";
        public const string InvalidOptionId = "INVALID_OPTION_ID";
        public const string EngineInSelectedOptions = "ENGINE_IN_SELECTED_OPTIONS";
        public const string DuplicateOptions = "DUPLICATE_OPTIONS";
        public const string MultipleCategorySelection = "MULTIPLE_CATEGORY_SELECTION";
        public const string EmptyConfigurationName = "EMPTY_CONFIGURATION_NAME";
        public const string ConfigurationNameTooLong = "CONFIGURATION_NAME_TOO_LONG";
        public const string DependencyMissing = "DEPENDENCY_MISSING";
        public const string ExclusionConflict = "EXCLUSION_CONFLICT";
    }

    private readonly List<CarOption> _options;
    private readonly List<OptionRule> _rules;
    private readonly List<PackageDiscount> _discounts;
    private readonly IConfigurationRepository _repository;

    public ConfigurationService()
        : this(new InMemoryConfigurationRepository())
    {
    }

    public ConfigurationService(IConfigurationRepository repository)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _options = SeedDefaultOptions();
        _rules = SeedDefaultRules();
        _discounts = SeedDefaultDiscounts();
    }

    public IReadOnlyList<OptionDto> GetAvailableOptions()
    {
        return _options.Select(o => new OptionDto
        {
            Id = o.Id,
            Code = o.Code,
            Name = o.Name,
            Category = o.Category,
            Price = o.Price,
            LayerImageUrl = o.LayerImageUrl,
            ZIndex = o.ZIndex
        }).ToList();
    }

    public ConfigurationEvaluationResultDto EvaluateConfiguration(ConfigurationRequestDto request)
    {
        var result = new ConfigurationEvaluationResultDto
        {
            IsValid = true,
            HasInvalidInput = false,
            CanSave = false,
            EngineOptionId = request?.EngineOptionId,
            SelectedOptionIds = request?.SelectedOptionIds != null
                ? new List<int>(request.SelectedOptionIds)
                : new List<int>()
        };

        // 1. Bemeneti adatok strukturális és kategória-kardinalitási validációja (nem rövidzáras!)
        if (!ValidateInput(request, result))
        {
            result.IsValid = false;
            result.CanSave = false;
            return result;
        }

        var engineOption = _options.First(o => o.Id == request!.EngineOptionId!.Value);
        var selectedIds = request!.SelectedOptionIds ?? new List<int>();
        var selectedOptions = selectedIds
            .Select(id => _options.First(o => o.Id == id))
            .ToList();

        var allSelectedIds = new HashSet<int>(selectedIds) { engineOption.Id };
        var allSelectedOptions = new List<CarOption>(selectedOptions.Count + 1) { engineOption };
        allSelectedOptions.AddRange(selectedOptions);

        // 2. Függőségi szabályok ellenőrzése (Elfogadási feltétel #2)
        CheckDependencies(allSelectedIds, result);

        // 3. Kizárási szabályok ellenőrzése - nem töröl némán opciót! (Elfogadási feltétel #3 és AGENTS.md 6. pont)
        CheckExclusions(allSelectedIds, result);

        // 4. Alapár és opciók árának számítása (Elfogadási feltétel #1)
        result.BasePrice = engineOption.Price;
        result.OptionsPrice = selectedOptions.Sum(o => o.Price);

        // 5. Csomagkedvezmények kalkulációja a teljes kiválasztott opcióhalmazból (Elfogadási feltétel #4)
        result.DiscountAmount = CalculateDiscounts(allSelectedIds, allSelectedOptions, result);

        result.TotalPrice = result.BasePrice + result.OptionsPrice - result.DiscountAmount;
        result.IsValid = result.Errors.Count == 0 && !result.HasInvalidInput;
        result.CanSave = result.IsValid;

        // 6. 2D vizuális rétegek összeállítása z-index szerint rendezve (Elfogadási feltétel #7)
        result.VisualLayers = BuildVisualLayers(selectedOptions);

        return result;
    }

    public ConfigurationEvaluationResultDto ValidateSaveRequest(SaveConfigurationRequestDto request)
    {
        if (request == null!)
        {
            return new ConfigurationEvaluationResultDto
            {
                IsValid = false,
                HasInvalidInput = true,
                CanSave = false,
                Errors = new List<ValidationIssueDto>
                {
                    new ValidationIssueDto
                    {
                        Code = ErrorCodes.NullRequest,
                        Message = "A mentési kérés nem lehet null."
                    }
                }
            };
        }

        var evalResult = EvaluateConfiguration(new ConfigurationRequestDto
        {
            EngineOptionId = request.EngineOptionId,
            SelectedOptionIds = request.SelectedOptionIds ?? new List<int>()
        });

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            evalResult.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.EmptyConfigurationName,
                Message = "A konfiguráció mentéséhez kötelező nevet megadni."
            });
            evalResult.HasInvalidInput = true;
            evalResult.IsValid = false;
            evalResult.CanSave = false;
        }
        else if (request.Name.Trim().Length > MaxConfigurationNameLength)
        {
            evalResult.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.ConfigurationNameTooLong,
                Message = $"A konfiguráció neve legfeljebb {MaxConfigurationNameLength} karakter lehet."
            });
            evalResult.HasInvalidInput = true;
            evalResult.IsValid = false;
            evalResult.CanSave = false;
        }

        return evalResult;
    }

    public ServiceResult<SavedConfigurationDto> SaveConfiguration(SaveConfigurationRequestDto request, string? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return ServiceResult<SavedConfigurationDto>.Failure(401, "Vendég felhasználó nem menthet konfigurációt (401 Unauthorized).");
        }

        var validation = ValidateSaveRequest(request);
        if (!validation.IsValid || !validation.CanSave)
        {
            return ServiceResult<SavedConfigurationDto>.Failure(
                400,
                "A konfiguráció érvénytelen vagy hibás bemeneti adatokat tartalmaz, ezért nem menthető.",
                validation);
        }

        var entity = new SavedConfiguration
        {
            Name = request.Name.Trim(),
            UserId = currentUserId,
            EngineOptionId = request.EngineOptionId!.Value,
            SelectedOptionIds = new List<int>(request.SelectedOptionIds),
            SavedTotalPrice = validation.TotalPrice
        };

        var saved = _repository.Add(entity);
        return ServiceResult<SavedConfigurationDto>.Success(MapToDtoWithRevalidation(saved), 201);
    }

    public ServiceResult<SavedConfigurationDto> GetSavedConfigurationById(int id, string? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return ServiceResult<SavedConfigurationDto>.Failure(401, "Bejelentkezés szükséges a mentett konfigurációk megtekintéséhez (401 Unauthorized).");
        }

        var saved = _repository.GetById(id);
        if (saved == null)
        {
            return ServiceResult<SavedConfigurationDto>.Failure(404, "A keresett konfiguráció nem található.");
        }

        if (!string.Equals(saved.UserId, currentUserId, StringComparison.Ordinal))
        {
            return ServiceResult<SavedConfigurationDto>.Failure(403, "Nincs jogosultság más felhasználó mentésének lekéréséhez (403 Forbidden).");
        }

        return ServiceResult<SavedConfigurationDto>.Success(MapToDtoWithRevalidation(saved), 200);
    }

    public ServiceResult<IReadOnlyList<SavedConfigurationDto>> GetUserConfigurations(string? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return ServiceResult<IReadOnlyList<SavedConfigurationDto>>.Failure(401, "Bejelentkezés szükséges a mentett konfigurációk listázásához (401 Unauthorized).");
        }

        var items = _repository.GetByUserId(currentUserId)
            .Select(MapToDtoWithRevalidation)
            .ToList();

        return ServiceResult<IReadOnlyList<SavedConfigurationDto>>.Success(items, 200);
    }

    public ServiceResult<SavedConfigurationDto> UpdateSavedConfiguration(int id, SaveConfigurationRequestDto request, string? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return ServiceResult<SavedConfigurationDto>.Failure(401, "Bejelentkezés szükséges a konfiguráció módosításához (401 Unauthorized).");
        }

        var existing = _repository.GetById(id);
        if (existing == null)
        {
            return ServiceResult<SavedConfigurationDto>.Failure(404, "A módosítani kívánt konfiguráció nem található.");
        }

        if (!string.Equals(existing.UserId, currentUserId, StringComparison.Ordinal))
        {
            return ServiceResult<SavedConfigurationDto>.Failure(403, "Nincs jogosultság más felhasználó mentésének módosításához (403 Forbidden).");
        }

        var validation = ValidateSaveRequest(request);
        if (!validation.IsValid || !validation.CanSave)
        {
            return ServiceResult<SavedConfigurationDto>.Failure(
                400,
                "A módosított konfiguráció érvénytelen vagy hibás adatokat tartalmaz.",
                validation);
        }

        existing.Name = request.Name.Trim();
        existing.EngineOptionId = request.EngineOptionId!.Value;
        existing.SelectedOptionIds = new List<int>(request.SelectedOptionIds);
        existing.SavedTotalPrice = validation.TotalPrice;

        var updated = _repository.Update(existing);
        return ServiceResult<SavedConfigurationDto>.Success(MapToDtoWithRevalidation(updated), 200);
    }

    public ServiceResult<bool> DeleteSavedConfiguration(int id, string? currentUserId)
    {
        if (string.IsNullOrWhiteSpace(currentUserId))
        {
            return ServiceResult<bool>.Failure(401, "Bejelentkezés szükséges a konfiguráció törléséhez (401 Unauthorized).");
        }

        var existing = _repository.GetById(id);
        if (existing == null)
        {
            return ServiceResult<bool>.Failure(404, "A törölni kívánt konfiguráció nem található.");
        }

        if (!string.Equals(existing.UserId, currentUserId, StringComparison.Ordinal))
        {
            return ServiceResult<bool>.Failure(403, "Nincs jogosultság más felhasználó mentésének törléséhez (403 Forbidden).");
        }

        _repository.Delete(id);
        return ServiceResult<bool>.Success(true, 204);
    }

    public void AddRule(OptionRule rule)
    {
        ArgumentNullException.ThrowIfNull(rule);
        _rules.Add(rule);
    }

    public void AddPackageDiscount(PackageDiscount discount)
    {
        ArgumentNullException.ThrowIfNull(discount);
        _discounts.Add(discount);
    }

    public void UpdateOptionPrice(int optionId, decimal newPrice)
    {
        var option = _options.FirstOrDefault(o => o.Id == optionId)
            ?? throw new KeyNotFoundException($"Option #{optionId} not found.");
        option.Price = newPrice;
    }

    private SavedConfigurationDto MapToDtoWithRevalidation(SavedConfiguration saved)
    {
        // AGENTS.md 6. pont és SPECIFICATION.md 4. pont:
        // Visszatöltéskor a backend újra-validálja és újraszámolja a konfigurációt,
        // miközben megőrzi a mentéskori SavedTotalPrice értéket.
        var currentEval = EvaluateConfiguration(new ConfigurationRequestDto
        {
            EngineOptionId = saved.EngineOptionId,
            SelectedOptionIds = new List<int>(saved.SelectedOptionIds)
        });

        return new SavedConfigurationDto
        {
            Id = saved.Id,
            Name = saved.Name,
            UserId = saved.UserId,
            EngineOptionId = saved.EngineOptionId,
            SelectedOptionIds = new List<int>(saved.SelectedOptionIds),
            SavedTotalPrice = saved.SavedTotalPrice,
            CurrentEvaluation = currentEval
        };
    }

    protected virtual bool ValidateInput(ConfigurationRequestDto? request, ConfigurationEvaluationResultDto result)
    {
        if (request == null)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.NullRequest,
                Message = "A konfigurációs kérés nem lehet null."
            });
            result.HasInvalidInput = true;
            return false;
        }

        // 1. Motor ellenőrzése
        if (!request.EngineOptionId.HasValue)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.MissingEngine,
                Message = "A motor kiválasztása kötelező."
            });
            result.HasInvalidInput = true;
        }
        else
        {
            var engineOption = _options.FirstOrDefault(o => o.Id == request.EngineOptionId.Value && o.Category == OptionCategory.Engine);
            if (engineOption == null)
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = ErrorCodes.InvalidEngineId,
                    Message = $"Érvénytelen motor azonosító: {request.EngineOptionId.Value}.",
                    AffectedOptionIds = new List<int> { request.EngineOptionId.Value }
                });
                result.HasInvalidInput = true;
            }
        }

        // 2. Duplikált opciók ellenőrzése (nem lép ki rövidzárral!)
        var selectedIds = request.SelectedOptionIds ?? new List<int>();
        if (selectedIds.Distinct().Count() != selectedIds.Count)
        {
            var duplicates = selectedIds
                .GroupBy(id => id)
                .Where(g => g.Count() > 1)
                .Select(g => g.Key)
                .ToList();

            result.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.DuplicateOptions,
                Message = "A kiválasztott opciók között duplikáció található.",
                AffectedOptionIds = duplicates
            });
            result.HasInvalidInput = true;
        }

        // 3. Minden egyes kiválasztott opció létezésének és típusának ellenőrzése (nem lép ki az első hibánál!)
        var validSelectedOptions = new List<CarOption>();
        foreach (var id in selectedIds.Distinct())
        {
            var option = _options.FirstOrDefault(o => o.Id == id);
            if (option == null)
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = ErrorCodes.InvalidOptionId,
                    Message = $"Nem létező opció azonosító: {id}.",
                    AffectedOptionIds = new List<int> { id }
                });
                result.HasInvalidInput = true;
            }
            else if (option.Category == OptionCategory.Engine)
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = ErrorCodes.EngineInSelectedOptions,
                    Message = $"Motor kategóriájú opció ({option.Name}) nem adható át az extrák/opciók listájában; használd az EngineOptionId mezőt.",
                    AffectedOptionIds = new List<int> { id }
                });
                result.HasInvalidInput = true;
            }
            else
            {
                validSelectedOptions.Add(option);
            }
        }

        // 4. Egyszeres választású kategóriák (ExteriorColor, Rim, Interior) kardinalitás-ellenőrzése
        var multiCategoryConflicts = validSelectedOptions
            .Where(o => SingleChoiceCategories.Contains(o.Category))
            .GroupBy(o => o.Category)
            .Where(g => g.Count() > 1);

        foreach (var categoryGroup in multiCategoryConflicts)
        {
            result.Errors.Add(new ValidationIssueDto
            {
                Code = ErrorCodes.MultipleCategorySelection,
                Message = $"A(z) {categoryGroup.Key} kategóriából egyszerre legfeljebb egy opció választható.",
                AffectedOptionIds = categoryGroup.Select(o => o.Id).ToList()
            });
            result.HasInvalidInput = true;
        }

        return result.Errors.Count == 0 && !result.HasInvalidInput;
    }

    protected virtual void CheckDependencies(HashSet<int> allSelectedIds, ConfigurationEvaluationResultDto result)
    {
        foreach (var rule in _rules.Where(r => r.RuleType == RuleType.Requires))
        {
            if (allSelectedIds.Contains(rule.SourceOptionId) && !allSelectedIds.Contains(rule.TargetOptionId))
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = ErrorCodes.DependencyMissing,
                    Message = rule.ErrorMessage,
                    AffectedOptionIds = new List<int> { rule.SourceOptionId, rule.TargetOptionId }
                });
            }
        }
    }

    protected virtual void CheckExclusions(HashSet<int> allSelectedIds, ConfigurationEvaluationResultDto result)
    {
        foreach (var rule in _rules.Where(r => r.RuleType == RuleType.Excludes))
        {
            if (allSelectedIds.Contains(rule.SourceOptionId) && allSelectedIds.Contains(rule.TargetOptionId))
            {
                result.Errors.Add(new ValidationIssueDto
                {
                    Code = ErrorCodes.ExclusionConflict,
                    Message = rule.ErrorMessage,
                    AffectedOptionIds = new List<int> { rule.SourceOptionId, rule.TargetOptionId }
                });
            }
        }
    }

    protected virtual decimal CalculateDiscounts(
        HashSet<int> allSelectedIds,
        List<CarOption> allSelectedOptions,
        ConfigurationEvaluationResultDto result)
    {
        decimal totalDiscount = 0m;

        foreach (var discount in _discounts)
        {
            if (discount.RequiredOptionIds.All(id => allSelectedIds.Contains(id)))
            {
                var packageSum = allSelectedOptions
                    .Where(o => discount.RequiredOptionIds.Contains(o.Id))
                    .Sum(o => o.Price);

                var discountValue = Math.Round(packageSum * discount.DiscountPercentage, 0);
                totalDiscount += discountValue;
                result.AppliedDiscounts.Add(discount.Name);
            }
        }

        return totalDiscount;
    }

    protected virtual List<LayerPreviewDto> BuildVisualLayers(List<CarOption> selectedOptions)
    {
        return selectedOptions
            .Where(o => !string.IsNullOrWhiteSpace(o.LayerImageUrl) && o.ZIndex.HasValue)
            .OrderBy(o => o.ZIndex!.Value)
            .ThenBy(o => o.Id)
            .Select(o => new LayerPreviewDto
            {
                OptionId = o.Id,
                OptionName = o.Name,
                Category = o.Category,
                LayerImageUrl = o.LayerImageUrl!,
                ZIndex = o.ZIndex!.Value
            })
            .ToList();
    }

    private static List<CarOption> SeedDefaultOptions() => new()
    {
        new CarOption { Id = OptionIds.BaseEngine, Code = "ENGINE_BASE", Name = "Alap motor", Category = OptionCategory.Engine, Price = 10_000_000m },
        new CarOption { Id = OptionIds.SportEngine, Code = "ENGINE_SPORT", Name = "Sport motor", Category = OptionCategory.Engine, Price = 13_500_000m },

        new CarOption { Id = OptionIds.BaseWhiteColor, Code = "COLOR_WHITE", Name = "Alap fehér", Category = OptionCategory.ExteriorColor, Price = 0m, LayerImageUrl = "/layers/color-white.svg", ZIndex = 20 },
        new CarOption { Id = OptionIds.MetallicColor, Code = "COLOR_METALLIC", Name = "Metál szín", Category = OptionCategory.ExteriorColor, Price = 250_000m, LayerImageUrl = "/layers/color-metallic.svg", ZIndex = 20 },
        new CarOption { Id = OptionIds.FireRedColor, Code = "COLOR_FIRERED", Name = "Tűzpiros", Category = OptionCategory.ExteriorColor, Price = 300_000m, LayerImageUrl = "/layers/color-firered.svg", ZIndex = 20 },

        new CarOption { Id = OptionIds.BaseRim17, Code = "RIM_17", Name = "17\" Alap felni", Category = OptionCategory.Rim, Price = 0m, LayerImageUrl = "/layers/rim-17.svg", ZIndex = 30 },
        new CarOption { Id = OptionIds.Rim18, Code = "RIM_18", Name = "18\" felni", Category = OptionCategory.Rim, Price = 350_000m, LayerImageUrl = "/layers/rim-18.svg", ZIndex = 30 },
        new CarOption { Id = OptionIds.SportRim19, Code = "RIM_19_SPORT", Name = "19\" Sport", Category = OptionCategory.Rim, Price = 550_000m, LayerImageUrl = "/layers/rim-19-sport.svg", ZIndex = 30 },

        new CarOption { Id = OptionIds.SportDiffuser, Code = "OPT_DIFFUSER", Name = "Sport diffúzor", Category = OptionCategory.ExteriorOptical, Price = 200_000m, LayerImageUrl = "/layers/opt-diffuser.svg", ZIndex = 40 },
        new CarOption { Id = OptionIds.TowHook, Code = "OPT_TOWHOOK", Name = "Vonóhorog", Category = OptionCategory.ExteriorOptical, Price = 250_000m, LayerImageUrl = "/layers/opt-towhook.svg", ZIndex = 40 },

        new CarOption { Id = OptionIds.FabricInterior, Code = "INT_FABRIC", Name = "Szövet kárpit", Category = OptionCategory.Interior, Price = 0m },
        new CarOption { Id = OptionIds.LeatherInterior, Code = "INT_LEATHER", Name = "Bőr kárpit", Category = OptionCategory.Interior, Price = 450_000m },

        new CarOption { Id = OptionIds.LargeNavigation, Code = "EXT_NAVI_LARGE", Name = "Nagy navigáció", Category = OptionCategory.Extra, Price = 300_000m },
        new CarOption { Id = OptionIds.PremiumSoundSystem, Code = "EXT_SOUND_PREMIUM", Name = "Prémium hangrendszer", Category = OptionCategory.Extra, Price = 400_000m },
        new CarOption { Id = OptionIds.SportSuspension, Code = "EXT_SUSP_SPORT", Name = "Sportfutómű", Category = OptionCategory.Extra, Price = 350_000m },

        new CarOption { Id = OptionIds.HeatedSeats, Code = "EXT_WINTER_SEATS", Name = "Ülésfűtés", Category = OptionCategory.Extra, Price = 150_000m },
        new CarOption { Id = OptionIds.HeatedSteeringWheel, Code = "EXT_WINTER_WHEEL", Name = "Kormányfűtés", Category = OptionCategory.Extra, Price = 100_000m },
        new CarOption { Id = OptionIds.HeatedWindshield, Code = "EXT_WINTER_WINDSHIELD", Name = "Fűthető szélvédő", Category = OptionCategory.Extra, Price = 150_000m }
    };

    private static List<OptionRule> SeedDefaultRules() => new()
    {
        new OptionRule
        {
            Id = 1,
            RuleType = RuleType.Requires,
            SourceOptionId = OptionIds.PremiumSoundSystem,
            TargetOptionId = OptionIds.LargeNavigation,
            ErrorMessage = "A „Prémium hangrendszer” választásához kötelező a „Nagy navigáció” kiválasztása."
        },
        new OptionRule
        {
            Id = 2,
            RuleType = RuleType.Excludes,
            SourceOptionId = OptionIds.BaseEngine,
            TargetOptionId = OptionIds.SportSuspension,
            ErrorMessage = "Az „Alap motor” és a „Sportfutómű” kizárják egymást."
        },
        new OptionRule
        {
            Id = 3,
            RuleType = RuleType.Excludes,
            SourceOptionId = OptionIds.SportDiffuser,
            TargetOptionId = OptionIds.TowHook,
            ErrorMessage = "A „Sport diffúzor” és a „Vonóhorog” nem választható együtt."
        }
    };

    private static List<PackageDiscount> SeedDefaultDiscounts() => new()
    {
        new PackageDiscount
        {
            Id = 1,
            Name = "Téli csomag",
            RequiredOptionIds = new List<int>
            {
                OptionIds.HeatedSeats,
                OptionIds.HeatedSteeringWheel,
                OptionIds.HeatedWindshield
            },
            DiscountPercentage = 0.20m
        }
    };
}
